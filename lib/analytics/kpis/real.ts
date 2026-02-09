import { query } from "@/lib/db";

export type AnalyticsKpisParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string; // пока не поддерживается: в interactions нет department_id
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
};

export type KpisResponse = {
  incoming: number;
  missed: number;
  ahtSec: number | null;
  operatorsOnCalls: number;
  operatorsTotal: number;
  fcrPct: number;
  avgWaitSec: number | null;
  slaPct: number | null;
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

export async function getKpis(params: AnalyticsKpisParams): Promise<KpisResponse> {
  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  const channelId = parseIntOrNull(params.channel);
  const queueId = parseIntOrNull(params.queue);
  const topicId = parseIntOrNull(params.topic);

  const where: string[] = [`i.started_at >= $1`, `i.started_at < $2`];
  const values: unknown[] = [fromDate.toISOString(), toDate.toISOString()];
  let idx = values.length;

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
      COUNT(*)::int AS incoming,
      COUNT(*) FILTER (WHERE i.status='unresolved' AND i.ended_at IS NULL)::int AS missed,
      ROUND(AVG(i.duration_sec) FILTER (WHERE i.status='resolved' AND i.duration_sec > 0))::int AS "ahtSec",
      COUNT(DISTINCT i.operator_id) FILTER (WHERE i.status='resolved')::int AS "operatorsOnCalls",
      ROUND(
        100.0 * AVG(CASE WHEN i.fcr THEN 1 ELSE 0 END),
        2
      )::float AS "fcrPct"
    FROM public.interactions i
    WHERE ${where.join(" AND ")}
  `;

  const { rows } = await query<{
    incoming: number;
    missed: number;
    ahtSec: number | null;
    operatorsOnCalls: number;
    fcrPct: number | null;
  }>(sql, values);

  const row = rows[0] ?? {
    incoming: 0,
    missed: 0,
    ahtSec: null,
    operatorsOnCalls: 0,
    fcrPct: 0,
  };

  const { rows: opRows } = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM public.operators`,
  );

  const operatorsTotal = opRows[0]?.total ?? 0;

  return {
    incoming: Number(row.incoming) || 0,
    missed: Number(row.missed) || 0,
    ahtSec: row.ahtSec === null ? null : Number(row.ahtSec),
    operatorsOnCalls: Number(row.operatorsOnCalls) || 0,
    operatorsTotal,
    fcrPct: row.fcrPct === null ? 0 : Number(row.fcrPct),
    avgWaitSec: null,
    slaPct: null,
  };
}
