import { NextResponse } from "next/server";
import type { PoolClient } from "pg";

import { getPool } from "@/lib/db";

const STATUS_MAP: Record<string, string> = {
  "Завершён": "completed",
  "Пропущен": "missed",
  "Ожидание": "waiting",
  "В разговоре": "in_progress",
};

const CHANNEL_NAME_MAP: Record<string, string> = {
  voice: "Звонки",
  chat: "Чат",
  email: "Email",
  sms: "SMS",
  push: "Push",
};

type IngestItem = {
  externalId: string;
  startedAt: string;
  channelCode: string;
  queueCode: string;
  departmentCode?: string | null;
  departmentNameRu?: string | null;
  operatorName?: string | null;
  topicName?: string | null;
  durationSec: number;
  statusRu: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function upsertDepartment(
  client: PoolClient,
  code: string,
  nameRu: string,
) {
  const result = await client.query(
    `INSERT INTO departments (department_code, name_ru)
     VALUES ($1, $2)
     ON CONFLICT (department_code)
     DO UPDATE SET name_ru = EXCLUDED.name_ru, updated_at = now()
     RETURNING id`,
    [code, nameRu],
  );
  return result.rows[0].id as number;
}

async function upsertChannel(client: PoolClient, code: string) {
  const nameRu = CHANNEL_NAME_MAP[code] ?? code;
  const result = await client.query(
    `INSERT INTO channels (channel_code, name_ru)
     VALUES ($1, $2)
     ON CONFLICT (channel_code)
     DO UPDATE SET name_ru = EXCLUDED.name_ru, updated_at = now()
     RETURNING id`,
    [code, nameRu],
  );
  return result.rows[0].id as number;
}

async function upsertQueue(
  client: PoolClient,
  code: string,
  nameRu: string,
  departmentId: number,
) {
  const result = await client.query(
    `INSERT INTO queues (queue_code, name_ru, department_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (queue_code)
     DO UPDATE SET name_ru = EXCLUDED.name_ru, department_id = EXCLUDED.department_id, updated_at = now()
     RETURNING id`,
    [code, nameRu, departmentId],
  );
  return result.rows[0].id as number;
}

async function upsertOperator(
  client: PoolClient,
  nameRu: string,
  departmentId: number | null,
) {
  const code = slugify(nameRu) || "operator";
  const result = await client.query(
    `INSERT INTO operators (operator_code, full_name_ru, department_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (operator_code)
     DO UPDATE SET full_name_ru = EXCLUDED.full_name_ru, department_id = EXCLUDED.department_id, updated_at = now()
     RETURNING id`,
    [code, nameRu, departmentId],
  );
  return result.rows[0].id as number;
}

async function upsertTopic(client: PoolClient, nameRu: string) {
  const code = slugify(nameRu) || "topic";
  const result = await client.query(
    `INSERT INTO topics (topic_code, name_ru)
     VALUES ($1, $2)
     ON CONFLICT (topic_code)
     DO UPDATE SET name_ru = EXCLUDED.name_ru, updated_at = now()
     RETURNING id`,
    [code, nameRu],
  );
  return result.rows[0].id as number;
}

export async function POST(request: Request) {
  let payload: { items?: IngestItem[] };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Некорректный JSON" } },
      { status: 400 },
    );
  }

  if (!payload?.items || !Array.isArray(payload.items) || payload.items.length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "items обязателен" } },
      { status: 400 },
    );
  }

  let client: PoolClient | null = null;
  let inserted = 0;
  let updated = 0;
  let rejected = 0;
  const errors: {
    index: number;
    externalId?: string | null;
    code: string;
    message: string;
  }[] = [];

  try {
    const pool = getPool();
    client = await pool.connect();
    await client.query("BEGIN");

    for (const [index, item] of payload.items.entries()) {
      if (
        !item.externalId ||
        !item.startedAt ||
        !item.channelCode ||
        !item.queueCode ||
        typeof item.durationSec !== "number" ||
        item.durationSec < 0 ||
        !item.statusRu
      ) {
        rejected += 1;
        errors.push({
          index,
          externalId: item.externalId ?? null,
          code: "VALIDATION_ERROR",
          message: "Обязательные поля отсутствуют",
        });
        continue;
      }

      const parsedStart = new Date(item.startedAt);
      if (Number.isNaN(parsedStart.getTime())) {
        rejected += 1;
        errors.push({
          index,
          externalId: item.externalId ?? null,
          code: "VALIDATION_ERROR",
          message: "Некорректный startedAt",
        });
        continue;
      }

      const status = STATUS_MAP[item.statusRu];
      if (!status) {
        rejected += 1;
        errors.push({
          index,
          externalId: item.externalId ?? null,
          code: "VALIDATION_ERROR",
          message: "Некорректный statusRu",
        });
        continue;
      }

      const departmentCode = item.departmentCode?.trim() || "unknown";
      const departmentName =
        item.departmentNameRu?.trim() || "Неизвестно";
      const departmentId = await upsertDepartment(
        client,
        departmentCode,
        departmentName,
      );

      const channelId = await upsertChannel(client, item.channelCode);
      const queueId = await upsertQueue(
        client,
        item.queueCode,
        item.queueCode,
        departmentId,
      );

      const operatorId = item.operatorName
        ? await upsertOperator(client, item.operatorName, departmentId)
        : null;
      const topicId = item.topicName
        ? await upsertTopic(client, item.topicName)
        : null;

      const upsertResult = await client.query(
        `INSERT INTO interactions (
           external_id,
           started_at,
           channel_id,
           queue_id,
           department_id,
           operator_id,
           topic_id,
           duration_sec,
           status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (external_id)
         DO UPDATE SET
           started_at = EXCLUDED.started_at,
           channel_id = EXCLUDED.channel_id,
           queue_id = EXCLUDED.queue_id,
           department_id = EXCLUDED.department_id,
           operator_id = EXCLUDED.operator_id,
           topic_id = EXCLUDED.topic_id,
           duration_sec = EXCLUDED.duration_sec,
           status = EXCLUDED.status,
           updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        [
          item.externalId,
          parsedStart,
          channelId,
          queueId,
          departmentId,
          operatorId,
          topicId,
          item.durationSec,
          status,
        ],
      );

      if (upsertResult.rows[0]?.inserted) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  } finally {
    client?.release();
  }

  return NextResponse.json({ inserted, updated, rejected, errors });
}
