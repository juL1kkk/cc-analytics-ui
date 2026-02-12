import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type ItemRow = {
  operator_id: number;
  operator_name: string;
  handled: number;
  missed: number;
  aht_sec: number | null;
};

type TrendRow = {
  t: string;
  aht_sec: number | null;
};

function parseDate(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function periodToRange(period: string | null) {
  const now = new Date();
  const end = now;
  const start = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  else if (period === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
  } else if (period === "7d") start.setDate(start.getDate() - 7);
  else if (period === "30d") start.setDate(start.getDate() - 30);
  else return null;
  return { from: start, to: end };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get("debug") === "1";

    const period = url.searchParams.get("period");
    const fromQ = parseDate(url.searchParams.get("from"));
    const toQ = parseDate(url.searchParams.get("to"));
    const range = periodToRange(period);

    const from = fromQ ?? range?.from ?? new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = toQ ?? range?.to ?? new Date();

    const dept = url.searchParams.get("dept")?.trim() || null;      // uuid
    const queueId = url.searchParams.get("queue")?.trim() || null;  // uuid (Queues.id)

    // queue_code нужен для FsCdr; если queueId задан — берём code из справочника Queues
    let queueCode: string | null = null;
    if (queueId) {
      const qRes = await query<{ code: string }>(
        `select code from cc_replica."Queues" where id = $1::uuid`,
        [queueId],
      );
      queueCode = qRes.rows[0]?.code ?? null;
    }

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
          and ($4::text is null or f.queue_code = $4)
      )
      select
       (dense_rank() over (order by operator_name))::int as operator_id,
        operator_name,
        count(*) filter (where answer_stamp is not null)::int as handled,
        count(*) filter (where answer_stamp is null)::int as missed,
        round(avg(billsec) filter (where answer_stamp is not null))::int as aht_sec
      from base
      group by operator_name
      order by handled desc, missed desc
    `;

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
        and ($4::text is null or f.queue_code = $4)
      group by 1
      order by 1 asc
    `;

    const params = [from, to, dept, queueCode];

    const itemsRes = await query<ItemRow>(itemsSql, params);
    const trendRes = await query<TrendRow>(trendSql, params);

    const items = itemsRes.rows.map((r) => ({
      operatorId: Number(r.operator_id),
      operatorNameRu: r.operator_name,
      handled: r.handled,
      missed: r.missed,
      ahtSec: r.aht_sec ?? null,
      fcrPct: 0.0, // позже, когда будет подтверждена логика FCR
    }));

    const trend = trendRes.rows.map((r) => ({
      t: new Date(r.t).toISOString(),
      ahtSec: r.aht_sec ?? null,
      asaSec: null,
    }));

    const body = { items, trend };
    return NextResponse.json(debug ? { ...body, debug: { itemsSql, trendSql, params } } : body);
  } catch (error) {
    console.error("operators v2 error", error);

    const url = new URL(request.url);
    const wantDetails = url.searchParams.get("debug") === "1";

    const details = wantDetails
      ? error instanceof Error
        ? error.message
        : String(error)
      : undefined;

    return NextResponse.json(
      {
        error: {
          code: "DB_ERROR",
          message: "Database error",
          ...(details ? { details } : {}),
        },
      },
      { status: 500 },
    );
  }
}
