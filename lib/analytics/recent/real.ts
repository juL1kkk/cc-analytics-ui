import { query } from "@/lib/db";

export type AnalyticsRecentParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string; // пока не поддерживается: нет interactions.department_id
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type RecentItem = {
  externalId: string;
  startedAt: string;
  channelCode: string;
  channelNameRu: string;
  queueCode: string;
  queueNameRu: string;
  departmentNameRu: string;
  operatorNameRu: string | null;
  topicNameRu: string | null;
  durationSec: number;
  statusCode: "completed" | "missed" | "waiting" | "in_progress";
  statusRu: "Завершён" | "Пропущен" | "Ожидание" | "В разговоре";
};

export type RecentResponse = {
  items: RecentItem[];
  total: number;
};

function parseDateOrNull(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIntOrNull(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getRecent(
  params: AnalyticsRecentParams,
): Promise<RecentResponse> {
  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  const channelId = parseIntOrNull(params.channel);
  const queueId = parseIntOrNull(params.queue);
  const topicId = parseIntOrNull(params.topic);

  const limit =
    typeof params.limit === "number" && params.limit > 0 ? params.limit : 20;
  const offset =
    typeof params.offset === "number" && params.offset >= 0
      ? params.offset
      : 0;

  const where: string[] = [`i.started_at >= $1`, `i.started_at < $2`];
  const values: unknown[] = [fromDate.toISOString(), toDate.toISOString()];
  let idx = values.length;

  // dept фильтр пока отключён: в interactions нет department_id
  if (channelId !== null) {
    idx += 1;
    where.push(`i.channel_id = $${idx}`);
    values.push(channelId);
  }
  if (queueId !== null) {
    idx += 1;
    where.push(`i.queue_id = $${idx}`);
    values.push(queueId);
  }
  if (topicId !== null) {
    idx += 1;
    where.push(`i.topic_id = $${idx}`);
    values.push(topicId);
  }

  // total
  const totalSql = `
    SELECT COUNT(*)::int AS total
    FROM public.interactions i
    WHERE ${where.join(" AND ")}
  `;
  const { rows: totalRows } = await query<{ total: number }>(totalSql, values);
  const total = totalRows[0]?.total ?? 0;

  // items
  idx += 1;
  values.push(limit);
  idx += 1;
  values.push(offset);

  const itemsSql = `
    SELECT
      i.id::text AS "externalId",
      i.started_at AS "startedAt",

      c.name AS "channelNameRu",
      c.name AS "channelCode",

      q.name AS "queueNameRu",
      q.name AS "queueCode",

      '—'::text AS "departmentNameRu",

      o.full_name AS "operatorNameRu",
      t.name AS "topicNameRu",

      COALESCE(i.duration_sec, 0)::int AS "durationSec",

      CASE
        WHEN i.status = 'resolved' THEN 'completed'
        WHEN i.status = 'unresolved' AND i.ended_at IS NULL THEN 'missed'
        WHEN i.status = 'unresolved' AND i.ended_at IS NOT NULL THEN 'waiting'
        ELSE 'in_progress'
      END AS "statusCode",

      CASE
        WHEN i.status = 'resolved' THEN 'Завершён'
        WHEN i.status = 'unresolved' AND i.ended_at IS NULL THEN 'Пропущен'
        WHEN i.status = 'unresolved' AND i.ended_at IS NOT NULL THEN 'Ожидание'
        ELSE 'В разговоре'
      END AS "statusRu"

    FROM public.interactions i
    JOIN public.channels c ON c.id = i.channel_id
    JOIN public.queues q ON q.id = i.queue_id
    LEFT JOIN public.operators o ON o.id = i.operator_id
    LEFT JOIN public.topics t ON t.id = i.topic_id

    WHERE ${where.join(" AND ")}
    ORDER BY i.started_at DESC
    LIMIT $${idx - 1} OFFSET $${idx}
  `;

  const { rows } = await query<RecentItem>(itemsSql, values);

  return {
    items: rows.map((r) => ({
      ...r,
      startedAt: new Date(r.startedAt).toISOString(),
      durationSec: Number(r.durationSec) || 0,
    })),
    total,
  };
}
