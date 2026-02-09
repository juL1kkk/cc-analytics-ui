import { query } from "@/lib/db";

export type AnalyticsOperatorsParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type OperatorItem = {
  operatorId: number;
  operatorNameRu: string;
  handled: number;
  missed: number;
  ahtSec: number | null;
  fcrPct: number | null;
};

export type OperatorTrendPoint = {
  t: string;
  ahtSec: number | null;
  asaSec: number | null;
};

export type OperatorsResponse = {
  items: OperatorItem[];
  trend: OperatorTrendPoint[];
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

export async function getOperators(
  params: AnalyticsOperatorsParams,
): Promise<OperatorsResponse> {
  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  const deptId = parseIntOrNull(params.dept);
  const channelId = parseIntOrNull(params.channel);
  const queueId = parseIntOrNull(params.queue);
  const topicId = parseIntOrNull(params.topic);

  const limit =
    typeof params.limit === "number" && params.limit > 0 ? params.limit : 20;
  const offset =
    typeof params.offset === "number" && params.offset >= 0 ? params.offset : 0;

  // ---- items (per operator) ----
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

  idx += 1;
  values.push(limit);
  idx += 1;
  values.push(offset);

  const itemsSql = `
    SELECT
      o.id AS "operatorId",
      o.full_name AS "operatorNameRu",
      COUNT(*) FILTER (WHERE i.status = 'resolved')::int AS handled,
      COUNT(*) FILTER (WHERE i.status = 'unresolved' AND i.ended_at IS NULL)::int AS missed,
      ROUND(AVG(i.duration_sec) FILTER (WHERE i.status = 'resolved' AND i.duration_sec > 0))::int AS "ahtSec",
      ROUND(100.0 * AVG(CASE WHEN i.fcr THEN 1 ELSE 0 END), 2)::float AS "fcrPct"
    FROM public.interactions i
    JOIN public.operators o ON o.id = i.operator_id
    WHERE ${where.join(" AND ")}
    GROUP BY o.id, o.full_name
    ORDER BY handled DESC, missed DESC, o.id ASC
    LIMIT $${idx - 1} OFFSET $${idx}
  `;

  const { rows: itemRows } = await query<{
    operatorId: number;
    operatorNameRu: string;
    handled: number;
    missed: number;
    ahtSec: number | null;
    fcrPct: number | null;
  }>(itemsSql, values);

  const items: OperatorItem[] = itemRows.map((r) => ({
    operatorId: Number(r.operatorId),
    operatorNameRu: r.operatorNameRu,
    handled: Number(r.handled) || 0,
    missed: Number(r.missed) || 0,
    ahtSec: r.ahtSec === null ? null : Number(r.ahtSec),
    fcrPct: r.fcrPct === null ? null : Number(r.fcrPct),
  }));

  // ---- trend (overall, per hour) ----
  // (минимально: AHT по часу; ASA пока null, т.к. нет очередных событий/ASA таблицы в контракте operators)
  const trendWhere: string[] = [`i.started_at >= $1`, `i.started_at < $2`];
  const trendValues: unknown[] = [fromDate.toISOString(), toDate.toISOString()];
  let tIdx = trendValues.length;

  if (deptId !== null) {
    tIdx += 1;
    trendWhere.push(`i.department_id = $${tIdx}`);
    trendValues.push(deptId);
  }
  if (channelId !== null) {
    tIdx += 1;
    trendWhere.push(`i.channel_id = $${tIdx}`);
    trendValues.push(channelId);
  }
  if (queueId !== null) {
    tIdx += 1;
    trendWhere.push(`i.queue_id = $${tIdx}`);
    trendValues.push(queueId);
  }
  if (topicId !== null) {
    tIdx += 1;
    trendWhere.push(`i.topic_id = $${tIdx}`);
    trendValues.push(topicId);
  }

  const trendSql = `
    SELECT
      date_trunc('hour', i.started_at) AS bucket,
      ROUND(AVG(i.duration_sec) FILTER (WHERE i.status = 'resolved' AND i.duration_sec > 0))::int AS "ahtSec"
    FROM public.interactions i
    WHERE ${trendWhere.join(" AND ")}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const { rows: trendRows } = await query<{ bucket: string | Date; ahtSec: number | null }>(
    trendSql,
    trendValues,
  );

  const trend: OperatorTrendPoint[] = trendRows.map((r) => {
    const d = r.bucket instanceof Date ? r.bucket : new Date(r.bucket);
    return {
      t: d.toISOString(),
      ahtSec: r.ahtSec === null ? null : Number(r.ahtSec),
      asaSec: null, // нет данных ASA в текущей interactions схеме
    };
  });

  return { items, trend };
}
