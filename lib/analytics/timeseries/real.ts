import { query } from "@/lib/db";

export type AnalyticsTimeSeriesParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string; // пока не поддерживается: в interactions нет department_id
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  granularity?: "auto" | "hour" | "day";
};

export type TimeSeriesPoint = {
  t: string;
  incoming: number;
  missed: number;
  ahtSec: number | null;
};

export type TimeSeriesResponse = {
  granularity: "hour" | "day";
  items: TimeSeriesPoint[];
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

export async function getTimeSeries(
  params: AnalyticsTimeSeriesParams,
): Promise<TimeSeriesResponse> {
  const granularity: "hour" | "day" = params.granularity === "day" ? "day" : "hour";
  const bucketExpr = granularity === "day" ? "date_trunc('day', i.started_at)" : "date_trunc('hour', i.started_at)";

  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  const channelId = parseIntOrNull(params.channel);
  const queueId = parseIntOrNull(params.queue);
  const topicId = parseIntOrNull(params.topic);

  const where: string[] = [`i.started_at >= $1`, `i.started_at < $2`];
  const values: unknown[] = [fromDate.toISOString(), toDate.toISOString()];
  let idx = values.length;

  // dept фильтр отключён: нет interactions.department_id
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
      ${bucketExpr} AS bucket,
      COUNT(*)::int AS incoming,
      COUNT(*) FILTER (WHERE i.status='unresolved' AND i.ended_at IS NULL)::int AS missed,
      ROUND(AVG(i.duration_sec) FILTER (WHERE i.status='resolved' AND i.duration_sec > 0))::int AS "ahtSec"
    FROM public.interactions i
    WHERE ${where.join(" AND ")}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const { rows } = await query<{
    bucket: string | Date;
    incoming: number;
    missed: number;
    ahtSec: number | null;
  }>(sql, values);

  const items: TimeSeriesPoint[] = rows.map((r) => {
    const d = r.bucket instanceof Date ? r.bucket : new Date(r.bucket);
    return {
      t: d.toISOString(),
      incoming: Number(r.incoming) || 0,
      missed: Number(r.missed) || 0,
      ahtSec: r.ahtSec === null ? null : Number(r.ahtSec),
    };
  });

  return { granularity, items };
}
