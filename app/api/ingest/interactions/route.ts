import { z } from "zod";

import { badRequest, internalError, zodErrorResponse } from "@/lib/api/responses";
import { getClient } from "@/lib/db";

const channelNames: Record<string, string> = {
  voice: "Звонки",
  chat: "Чат",
  email: "Email",
  sms: "SMS",
  push: "Push",
};

const statusMap: Record<string, "completed" | "missed" | "waiting" | "in_progress"> = {
  "Завершён": "completed",
  "Пропущен": "missed",
  "Ожидание": "waiting",
  "В разговоре": "in_progress",
};

const ingestSchema = z.object({
  items: z
    .array(
      z.object({
        externalId: z.string().min(1),
        startedAt: z.string().datetime({ offset: true }),
        channelCode: z.enum(["voice", "chat", "email", "sms", "push"]),
        queueCode: z.string().min(1),
        departmentCode: z.string().nullable().optional(),
        departmentNameRu: z.string().nullable().optional(),
        operatorName: z.string().nullable().optional(),
        topicName: z.string().nullable().optional(),
        durationSec: z.number().int().min(0),
        statusRu: z.enum(["Завершён", "Пропущен", "Ожидание", "В разговоре"]),
      }),
    )
    .min(1),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function makeCode(value: string, fallbackPrefix: string) {
  const slug = slugify(value);
  if (slug) {
    return slug;
  }
  return `${fallbackPrefix}_${hashString(value)}`;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest("Некорректный JSON в теле запроса.");
  }

  const parsed = ingestSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const client = await getClient();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");

    for (const item of parsed.data.items) {
      const channelName = channelNames[item.channelCode] ?? item.channelCode;
      const channelResult = await client.query<{ id: number }>(
        `INSERT INTO channels (channel_code, name_ru)
         VALUES ($1, $2)
         ON CONFLICT (channel_code)
         DO UPDATE SET name_ru = EXCLUDED.name_ru, updated_at = now()
         RETURNING id;`,
        [item.channelCode, channelName],
      );
      const channelId = channelResult.rows[0].id;

      let departmentId: number | null = null;
      if (item.departmentCode) {
        const departmentName = item.departmentNameRu ?? item.departmentCode;
        const departmentResult = await client.query<{ id: number }>(
          `INSERT INTO departments (department_code, name_ru)
           VALUES ($1, $2)
           ON CONFLICT (department_code)
           DO UPDATE SET name_ru = EXCLUDED.name_ru, updated_at = now()
           RETURNING id;`,
          [item.departmentCode, departmentName],
        );
        departmentId = departmentResult.rows[0].id;
      } else {
        const queueLookup = await client.query<{ department_id: number }>(
          "SELECT department_id FROM queues WHERE queue_code = $1;",
          [item.queueCode],
        );
        if (queueLookup.rows[0]) {
          departmentId = queueLookup.rows[0].department_id;
        }
      }

      if (!departmentId) {
        const fallbackResult = await client.query<{ id: number }>(
          `INSERT INTO departments (department_code, name_ru)
           VALUES ('unknown', 'Неизвестно')
           ON CONFLICT (department_code)
           DO UPDATE SET name_ru = EXCLUDED.name_ru, updated_at = now()
           RETURNING id;`,
        );
        departmentId = fallbackResult.rows[0].id;
      }

      const queueResult = await client.query<{ id: number }>(
        `INSERT INTO queues (queue_code, name_ru, department_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (queue_code)
         DO UPDATE SET name_ru = EXCLUDED.name_ru, department_id = EXCLUDED.department_id, updated_at = now()
         RETURNING id;`,
        [item.queueCode, item.queueCode, departmentId],
      );
      const queueId = queueResult.rows[0].id;

      let operatorId: number | null = null;
      if (item.operatorName) {
        const operatorCode = makeCode(item.operatorName, "operator");
        const operatorResult = await client.query<{ id: number }>(
          `INSERT INTO operators (operator_code, full_name_ru, department_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (operator_code)
           DO UPDATE SET full_name_ru = EXCLUDED.full_name_ru, department_id = EXCLUDED.department_id, updated_at = now()
           RETURNING id;`,
          [operatorCode, item.operatorName, departmentId],
        );
        operatorId = operatorResult.rows[0].id;
      }

      let topicId: number | null = null;
      if (item.topicName) {
        const topicCode = makeCode(item.topicName, "topic");
        const topicResult = await client.query<{ id: number }>(
          `INSERT INTO topics (topic_code, name_ru)
           VALUES ($1, $2)
           ON CONFLICT (topic_code)
           DO UPDATE SET name_ru = EXCLUDED.name_ru, updated_at = now()
           RETURNING id;`,
          [topicCode, item.topicName],
        );
        topicId = topicResult.rows[0].id;
      }

      const statusCode = statusMap[item.statusRu];
      const interactionResult = await client.query<{ inserted: boolean }>(
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
        RETURNING (xmax = 0) AS inserted;`,
        [
          item.externalId,
          new Date(item.startedAt),
          channelId,
          queueId,
          departmentId,
          operatorId,
          topicId,
          item.durationSec,
          statusCode,
        ],
      );

      if (interactionResult.rows[0]?.inserted) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    await client.query("COMMIT");

    return Response.json({
      inserted,
      updated,
      rejected: 0,
      errors: [],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to ingest interactions", error);
    return internalError();
  } finally {
    client.release();
  }
}
