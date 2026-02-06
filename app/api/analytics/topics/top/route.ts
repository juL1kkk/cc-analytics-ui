import { NextResponse } from "next/server";

import { buildFilteredCte, parseLimitOffset } from "@/lib/analytics";
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

    const pagination = parseLimitOffset(searchParams, { limit: 10, offset: 0 });
    if (!pagination) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Некорректные параметры" } },
        { status: 400 },
      );
    }

    const topSql = `
      ${filters.cte}
      SELECT
        topic_id AS "topicId",
        topic_name_ru AS "topicNameRu",
        count(*)::int AS count,
        round(avg(duration_sec) FILTER (WHERE status = 'completed' AND duration_sec > 0))::int AS "avgHandleSec",
        round(
          100.0 * count(*) FILTER (WHERE status = 'completed') / NULLIF(count(*), 0),
          2
        ) AS "fcrPct"
      FROM filtered
      WHERE topic_id IS NOT NULL
      GROUP BY topic_id, topic_name_ru
      ORDER BY count DESC
      LIMIT $${filters.values.length + 1}
    `;
    const topTopics = await query(topSql, [
      ...filters.values,
      pagination.limit,
    ]);

    const channelSql = `
      ${filters.cte}
      SELECT
        channel_name_ru AS "nameRu",
        count(*)::float AS value
      FROM filtered
      GROUP BY channel_name_ru
      ORDER BY value DESC
    `;
    const channelSplit = await query(channelSql, filters.values);

    return NextResponse.json({
      topTopics: topTopics.rows,
      channelSplit: channelSplit.rows,
      sentimentSplit: null,
      goalSplit: null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
