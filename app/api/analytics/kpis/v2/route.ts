import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type Row = {
  incoming: number;
  missed: number;
  completed: number;
  aht_sec: number;
  total: number;
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

    // Пока фильтруем по queue_code (потому что в FsCdr так хранится)
    const queueCode = url.searchParams.get("queue")?.trim() || null;

    const sql = `
      select
        count(*) filter (where direction = 'inbound')::int as incoming,
        count(*) filter (where direction = 'inbound' and answer_stamp is null)::int as missed,
        count(*) filter (where direction = 'inbound' and answer_stamp is not null)::int as completed,
        coalesce(round(avg(billsec) filter (where direction = 'inbound' and answer_stamp is not null))::int, 0) as aht_sec,
        count(*) filter (where direction = 'inbound')::int as total
      from cc_replica."FsCdr"
      where start_stamp >= $1::timestamptz
        and start_stamp <  $2::timestamptz
        and ($3::text is null or queue_code = $3)
    `;

    const params = [from, to, queueCode];
    const { rows } = await query<Row>(sql, params);
    const r = rows[0] ?? { incoming: 0, missed: 0, completed: 0, aht_sec: 0, total: 0 };

    const body = {
      incoming: r.incoming,
      missed: r.missed,
      completed: r.completed,
      ahtSec: r.aht_sec,
      total: r.total,
    };

    return NextResponse.json(debug ? { ...body, debug: { sql, params } } : body);
  } catch (error) {
    console.error("kpis v2 error", error);

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
