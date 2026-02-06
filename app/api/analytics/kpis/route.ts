import { NextResponse } from "next/server";

import { buildFilteredCte } from "@/lib/analytics";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = buildFilteredCte(searchParams);
    if (!filters) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Некорректные параметры" } },
        { status: 400 },
      );
    }

    const sql = `
      ${filters.cte}
      SELECT
        count(*)::int AS incoming,
        count(*) FILTER (WHERE status = 'missed')::int AS missed,
        round(avg(duration_sec) FILTER (WHERE status = 'completed' AND duration_sec > 0))::int AS "ahtSec",
        count(DISTINCT operator_id) FILTER (WHERE operator_id IS NOT NULL)::int AS "operatorsOnCalls",
        (SELECT count(*) FROM operators WHERE is_active = true)::int AS "operatorsTotal",
        round(
          100.0 * count(*) FILTER (WHERE status = 'completed') / NULLIF(count(*), 0),
          2
        ) AS "fcrPct",
        NULL::int AS "avgWaitSec",
        NULL::numeric AS "slaPct"
      FROM filtered
    `;

    const result = await query(sql, filters.values);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
