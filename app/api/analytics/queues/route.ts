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
        queue_code AS "queueCode",
        queue_name_ru AS "queueNameRu",
        count(*)::int AS total,
        round(
          100.0 * count(*) FILTER (WHERE status = 'missed') / NULLIF(count(*), 0),
          2
        ) AS "abandonedPct",
        NULL::int AS waiting,
        NULL::int AS "avgWaitSec",
        NULL::numeric AS "slaPct"
      FROM filtered
      GROUP BY queue_code, queue_name_ru
      ORDER BY total DESC
    `;
    const result = await query(sql, filters.values);

    return NextResponse.json({ items: result.rows, queueDepthTrend: null });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
