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
        channel_code AS "channelCode",
        channel_name_ru AS "channelNameRu",
        count(*)::int AS incoming,
        NULL::int AS outgoing,
        NULL::int AS "responseSec"
      FROM filtered
      GROUP BY channel_code, channel_name_ru
      ORDER BY incoming DESC
    `;
    const result = await query(sql, filters.values);

    return NextResponse.json({ split: result.rows, responseTrend: [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
