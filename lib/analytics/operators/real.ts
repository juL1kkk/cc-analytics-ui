import { query } from "@/lib/db";

export type AnalyticsOperatorsParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;    // uuid
  channel?: string; // uuid (опционально, через Call)
  queue?: string;   // queue_code (string) или uuid queue_id — в UI сейчас чаще uuid, но в FsCdr queue_code
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

function periodToRange(period?: string): { from: Date; to: Date } | null {
  if (!period) return null;
  const now = new Date();
  const to = now;
  const from = new Date(now);

  if (period === "today") from.setHours(0, 0, 0, 0);
  else if (period === "yesterday") {
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
  } else if (period === "7d") from.setDate(from.getDate() - 7);
  else if (period === "30d") from.setDate(from.getDate() - 30);
  else return null;

  return { from, to };
}

export async function getOperators(
  params: AnalyticsOperatorsParams,
): Promise<OperatorsResponse> {
  const range = periodToRange(params.period);

  const fromDate =
    parseDateOrNull(params.from) ??
    range?.from ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const toDate = parseDateOrNull(params.to) ?? range?.to ?? new Date();

  const deptId = params.dept?.trim() || null;       // uuid
  const channelId = params.channel?.trim() || null; // uuid
  const queue = params.queue?.trim() || null;       // ASSUMPTION: для operators используем FsCdr.queue_code (string)
  const q = params.q?.trim() || null;

  const limit =
    typeof params.limit === "number" && params.limit > 0 ? params.limit : 20;
  const offset =
    typeof params.offset === "number" && params.offset >= 0 ? params.offset : 0;

  // ---- items (per operator) ----
  const itemsSql = `
    with base as (
      select
        u.name as operator_name,
        f.start_stamp,
        f.answer_stamp,
        f.billsec
      from cc_replica."FsCdr" f
      join cc_replica."Call" c on c.fs_uuid = f.id
      join cc_replica."User" u on u.id = c.user_id
      where f.start_stamp >= $1::timestamptz
        and f.start_stamp <  $2::timestamptz
        and f.direction = 'inbound'
        and ($3::uuid is null or u.department_id = $3::uuid)
        and ($4::uuid is null or c.channel_id = $4::uuid)
        and ($5::text is null or f.queue_code = $5)
        and ($6::text is null
             or f.caller ilike '%' || $6 || '%'
             or f.callee ilike '%' || $6 || '%'
             or c."requestNum" ilike '%' || $6 || '%')
    )
    select
      (dense_rank() over (order by operator_name))::int as operator_id,
      operator_name,
      count(*) filter (where answer_stamp is not null)::int as handled,
      count(*) filter (where answer_stamp is null)::int as missed,
      round(avg(billsec) filter (where answer_stamp is not null))::int as aht_sec
    from base
    group by operator_name
    order by handled desc, missed desc, operator_name asc
    limit $7 offset $8
  `;

  const itemsParams = [
    fromDate.toISOString(),
    toDate.toISOString(),
    deptId,
    channelId,
    queue,
    q,
    limit,
    offset,
  ];

  const { rows: itemRows } = await query<{
    operator_id: number;
    operator_name: string;
    handled: number;
    missed: number;
    aht_sec: number | null;
  }>(itemsSql, itemsParams);

  const items: OperatorItem[] = itemRows.map((r) => ({
    operatorId: Number(r.operator_id),
    operatorNameRu: r.operator_name,
    handled: Number(r.handled) || 0,
    missed: Number(r.missed) || 0,
    ahtSec: r.aht_sec === null ? null : Number(r.aht_sec),
    fcrPct: 0, // пока нет данных для FCR
  }));

  // ---- trend (overall, per hour) ----
  const trendSql = `
    select
      date_trunc('hour', f.start_stamp) as t,
      round(avg(f.billsec) filter (where f.answer_stamp is not null))::int as aht_sec
    from cc_replica."FsCdr" f
    join cc_replica."Call" c on c.fs_uuid = f.id
    join cc_replica."User" u on u.id = c.user_id
    where f.start_stamp >= $1::timestamptz
      and f.start_stamp <  $2::timestamptz
      and f.direction = 'inbound'
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::uuid is null or c.channel_id = $4::uuid)
      and ($5::text is null or f.queue_code = $5)
      and ($6::text is null
           or f.caller ilike '%' || $6 || '%'
           or f.callee ilike '%' || $6 || '%'
           or c."requestNum" ilike '%' || $6 || '%')
    group by 1
    order by 1 asc
  `;

  const trendParams = [
    fromDate.toISOString(),
    toDate.toISOString(),
    deptId,
    channelId,
    queue,
    q,
  ];

  const { rows: trendRows } = await query<{
    t: string | Date;
    aht_sec: number | null;
  }>(trendSql, trendParams);

  const trend: OperatorTrendPoint[] = trendRows.map((r) => {
    const d = r.t instanceof Date ? r.t : new Date(r.t);
    return { t: d.toISOString(), ahtSec: r.aht_sec === null ? null : Number(r.aht_sec), asaSec: null };
  });

  return { items, trend };
}
