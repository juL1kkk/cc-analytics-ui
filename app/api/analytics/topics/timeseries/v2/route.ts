import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type Row = {
  t: string;
  incoming: number;
  missed: number;
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

    const topic = url.searchParams.get("topic")?.trim();
    if (!topic) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "topic is required" } },
        { status: 400 },
      );
    }

    const period = url.searchParams.get("period");
    const fromQ = parseDate(url.searchParams.get("from"));
    const toQ = parseDate(url.searchParams.get("to"));
    const range = periodToRange(period);

    const from = fromQ ?? range?.from ?? new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = toQ ?? range?.to ?? new Date();

    const dept = url.searchParams.get("dept")?.trim() || null;       // uuid
    const channel = url.searchParams.get("channel")?.trim() || null; // uuid
    const queue = url.searchParams.get("queue")?.trim() || null;     // uuid
    const q = url.searchParams.get("q")?.trim() || null;

    const sql = `
      select
        date_trunc('hour', f.start_stamp) as t,
        count(*) filter (where f.direction = 'inbound')::int as incoming,
        count(*) filter (where f.direction = 'inbound' and f.answer_stamp is null)::int as missed
      from cc_replica."Call" c
      join cc_replica."FsCdr" f on f.id = c.fs_uuid
      left join cc_replica."User" u on u.id = c.user_id
      where f.start_stamp >= $1::timestamptz
        and f.start_stamp <  $2::timestamptz
        and ($3::uuid is null or u.department_id = $3::uuid)
        and ($4::uuid is null or c.channel_id = $4::uuid)
        and ($5::uuid is null or c.queue_id = $5::uuid)
        and ($6::text is null or c."requestNum" ilike '%' || $6 || '%')
        and (
          $7::text = 'all'
          or c."ticketSubject_id" = $7::uuid
        )
      group by 1
      order by 1 asc
    `;

    const params = [from, to, dept, channel, queue, q, topic];

    const { rows } = await query<Row>(sql, params);

    const items = rows.map((r) => ({
      t: new Date(r.t).toISOString(),
      incoming: r.incoming,
      missed: r.missed,
    }));

    const body = { topic, items };
    return NextResponse.json(debug ? { ...body, debug: { sql, params } } : body);
  } catch (error) {
    console.error("topics timeseries v2 error", error);

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
