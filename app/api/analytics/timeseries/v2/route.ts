import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveV2PeriodRange } from "@/lib/periodRange";

export const runtime = "nodejs";

type Row = {
  t: string; // timestamptz from PG
  incoming: number;
  missed: number;
  ahtsec: number | null;
};


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get("debug") === "1";

    const period = url.searchParams.get("period");
    const { from, to } = await resolveV2PeriodRange({
      period,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      fallbackFrom: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });

    const granularityRaw = (url.searchParams.get("granularity") || "hour").toLowerCase();
    const granularity = granularityRaw === "day" ? "day" : "hour"; // allow only hour|day

    // В FsCdr пока фильтруем по queue_code (строка "1"/"2"/"3")
    const queueCode = url.searchParams.get("queue")?.trim() || null;

    // безопасно: granularity только hour/day, остальное параметрами
    const sql = `
      select
        date_trunc('${granularity}', start_stamp) as t,
        count(*) filter (where direction = 'inbound')::int as incoming,
        count(*) filter (where direction = 'inbound' and answer_stamp is null)::int as missed,
        round(avg(billsec) filter (where direction = 'inbound' and answer_stamp is not null))::int as ahtSec
      from cc_replica."FsCdr"
      where start_stamp >= $1::timestamptz
        and start_stamp <  $2::timestamptz
        and ($3::text is null or queue_code = $3)
      group by 1
      order by 1 asc
    `;

    const params = [from, to, queueCode];
    const { rows } = await query<Row>(sql, params);

    const items = rows.map((r) => ({
      t: new Date(r.t).toISOString(),
      incoming: r.incoming,
      missed: r.missed,
      ahtSec: r.ahtsec ?? null,
    }));

    const body = { granularity, items };
    return NextResponse.json(debug ? { ...body, debug: { sql, params } } : body);
  } catch (error) {
    console.error("timeseries v2 error", error);

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
