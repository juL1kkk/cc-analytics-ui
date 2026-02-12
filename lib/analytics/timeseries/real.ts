import { query } from "@/lib/db";

export type AnalyticsTimeSeriesParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string; // uuid department_id
  channel?: string; // (пока не используем: в FsCdr нет channel_id)
  queue?: string; // queue_code (string), но в старом контракте приходит как string
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

export async function getTimeSeries(
  params: AnalyticsTimeSeriesParams,
): Promise<TimeSeriesResponse> {
  const granularity: "hour" | "day" = params.granularity === "day" ? "day" : "hour";
  const bucketExpr =
    granularity === "day"
      ? "date_trunc('day', f.start_stamp)"
      : "date_trunc('hour', f.start_stamp)";

  const range = periodToRange(params.period);

  const fromDate =
    parseDateOrNull(params.from) ??
    range?.from ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const toDate = parseDateOrNull(params.to) ?? range?.to ?? new Date();

  const deptId = params.dept?.trim() || null; // uuid
  const queueCode = params.queue?.trim() || null; // string code ("1"/"2"/"3")
  const q = params.q?.trim() || null;

  // channel/topic фильтры в FsCdr напрямую нет (channelId/topicId живут в Call),
  // подключим позже, когда решим единый источник (FsCdr vs Call).
  const sql = `
    select
      ${bucketExpr} as t,
      count(*) filter (where f.direction = 'inbound')::int as incoming,
      count(*) filter (where f.direction = 'inbound' and f.answer_stamp is null)::int as missed,
      round(avg(f.billsec) filter (where f.direction = 'inbound' and f.answer_stamp is not null))::int as aht_sec
    from cc_replica."FsCdr" f
    left join cc_replica."Call" c on c.fs_uuid = f.id
    left join cc_replica."User" u on u.id = c.user_id
    where f.start_stamp >= $1::timestamptz
      and f.start_stamp <  $2::timestamptz
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::text is null or f.queue_code = $4)
      and ($5::text is null
           or f.caller ilike '%' || $5 || '%'
           or f.callee ilike '%' || $5 || '%'
           or c."requestNum" ilike '%' || $5 || '%')
    group by 1
    order by 1 asc
  `;

  const values = [fromDate.toISOString(), toDate.toISOString(), deptId, queueCode, q];

  const { rows } = await query<{
    t: string | Date;
    incoming: number;
    missed: number;
    aht_sec: number | null;
  }>(sql, values);

  const items: TimeSeriesPoint[] = rows.map((r) => {
    const d = r.t instanceof Date ? r.t : new Date(r.t);
    return {
      t: d.toISOString(),
      incoming: Number(r.incoming) || 0,
      missed: Number(r.missed) || 0,
      ahtSec: r.aht_sec === null ? null : Number(r.aht_sec),
    };
  });

  return { granularity, items };
}
