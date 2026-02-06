import { NextResponse } from "next/server";

import {
  buildFilteredCte,
  formatTime,
  resolveGranularity,
} from "@/lib/analytics";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic");
    if (!topic) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Параметр topic обязателен" } },
        { status: 400 },
      );
    }

    const filters = buildFilteredCte(searchParams);
    if (!filters) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Некорректные параметры" } },
        { status: 400 },
      );
    }

    const granularity = resolveGranularity(searchParams, filters);
    const sql = `
      ${filters.cte}
      SELECT
        date_trunc($${filters.values.length + 1}, started_at) AS t,
        count(*)::int AS incoming,
        count(*) FILTER (WHERE status = 'missed')::int AS missed
      FROM filtered
      GROUP BY 1
      ORDER BY 1
    `;
    const result = await query(sql, [...filters.values, granularity]);
    const items = result.rows.map((row) => ({
      t: formatTime(row.t),
      incoming: row.incoming,
      missed: row.missed,
    }));

    return NextResponse.json({ topic, items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
