import { NextResponse } from "next/server";

import {
  buildFilteredCte,
  formatTime,
  parseLimitOffset,
  resolveGranularity,
} from "@/lib/analytics";
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

    const pagination = parseLimitOffset(searchParams);
    if (!pagination) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Некорректные параметры" } },
        { status: 400 },
      );
    }

    const itemsSql = `
      ${filters.cte}
      SELECT
        operator_id AS "operatorId",
        operator_name_ru AS "operatorNameRu",
        count(*) FILTER (WHERE status <> 'missed')::int AS handled,
        count(*) FILTER (WHERE status = 'missed')::int AS missed,
        round(avg(duration_sec) FILTER (WHERE duration_sec > 0 AND status = 'completed'))::int AS "ahtSec",
        round(
          100.0 * count(*) FILTER (WHERE status = 'completed') / NULLIF(count(*), 0),
          2
        ) AS "fcrPct"
      FROM filtered
      WHERE operator_id IS NOT NULL
      GROUP BY operator_id, operator_name_ru
      ORDER BY handled DESC NULLS LAST
      LIMIT $${filters.values.length + 1}
      OFFSET $${filters.values.length + 2}
    `;
    const itemsResult = await query(itemsSql, [
      ...filters.values,
      pagination.limit,
      pagination.offset,
    ]);

    const granularity = resolveGranularity(searchParams, filters);
    const trendSql = `
      ${filters.cte}
      SELECT
        date_trunc($${filters.values.length + 1}, started_at) AS t,
        round(avg(duration_sec) FILTER (WHERE status = 'completed' AND duration_sec > 0))::int AS "ahtSec",
        NULL::int AS "asaSec"
      FROM filtered
      GROUP BY 1
      ORDER BY 1
    `;
    const trendResult = await query(trendSql, [
      ...filters.values,
      granularity,
    ]);
    const trend = trendResult.rows.map((row) => ({
      t: formatTime(row.t),
      ahtSec: row.ahtSec,
      asaSec: row.asaSec,
    }));

    return NextResponse.json({ items: itemsResult.rows, trend });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
