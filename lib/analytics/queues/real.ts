import { query } from "@/lib/db";

export type AnalyticsQueuesParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
};

export type QueueItem = {
  queueCode: string;
  queueNameRu: string;
  total: number;
  abandonedPct: number | null;
  waiting: number;
  avgWaitSec: number;
  slaPct: number;
};

export type QueueDepthTrendPoint = {
  t: string;
  value: number;
};

export type QueuesResponse = {
  items: QueueItem[];
  queueDepthTrend: QueueDepthTrendPoint[];
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

export async function getQueues(params: AnalyticsQueuesParams): Promise<QueuesResponse> {
  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  const deptId = parseIntOrNull(params.dept);
  const channelId = parseIntOrNull(params.channel);
  const queueId = parseIntOrNull(params.queue);
  const topicId = parseIntOrNull(params.topic);

  const where: string[] = [`i.started_at >= $1`, `i.started_at < $2`];
  const values: unknown[] = [fromDate.toISOString(), toDate.toISOString()];
  let idx = values.length;

  if (deptId !== null) {
    idx += 1;
    where.push(`i.department_id = $${idx}`);
    values.push(deptId);
  }
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

  const sql = `
    SELECT
      q.name AS "queueNameRu",
      q.name AS "queueCode",
      COUNT(*)::int AS "total",
      ROUND(
        100.0 * (COUNT(*) FILTER (WHERE i.status='unresolved' AND i.ended_at IS NULL)) / NULLIF(COUNT(*), 0),
        2
      )::float AS "abandonedPct"
    FROM public.interactions i
    JOIN public.queues q ON q.id = i.queue_id
    WHERE ${where.join(" AND ")}
    GROUP BY q.name
    ORDER BY COUNT(*) DESC, q.name ASC
  `;

  const { rows } = await query<{
    queueNameRu: string;
    queueCode: string;
    total: number;
    abandonedPct: number | null;
  }>(sql, values);

  const items: QueueItem[] = rows.map((r) => ({
    queueCode: r.queueCode,
    queueNameRu: r.queueNameRu,
    total: Number(r.total) || 0,
    abandonedPct: r.abandonedPct === null ? null : Number(r.abandonedPct),
    waiting: 0,
    avgWaitSec: 0,
    slaPct: 0,
  }));

  return {
    items,
    queueDepthTrend: [],
  };
}
