import { NextResponse } from "next/server";

import { buildFilteredCte, formatTime, parseLimitOffset } from "@/lib/analytics";
import { query } from "@/lib/db";

const STATUS_RU: Record<string, string> = {
  completed: "Завершён",
  missed: "Пропущен",
  waiting: "Ожидание",
  in_progress: "В разговоре",
};

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

    const sql = `
      ${filters.cte}
      SELECT
        external_id AS "externalId",
        started_at AS "startedAt",
        channel_code AS "channelCode",
        channel_name_ru AS "channelNameRu",
        queue_code AS "queueCode",
        queue_name_ru AS "queueNameRu",
        department_name_ru AS "departmentNameRu",
        operator_name_ru AS "operatorNameRu",
        topic_name_ru AS "topicNameRu",
        duration_sec AS "durationSec",
        status AS "statusCode"
      FROM filtered
      ORDER BY started_at DESC
      LIMIT $${filters.values.length + 1}
      OFFSET $${filters.values.length + 2}
    `;
    const result = await query(sql, [
      ...filters.values,
      pagination.limit,
      pagination.offset,
    ]);

    const items = result.rows.map((row) => ({
      ...row,
      startedAt: formatTime(row.startedAt),
      statusRu: STATUS_RU[row.statusCode] ?? row.statusCode,
    }));

    const totalSql = `
      ${filters.cte}
      SELECT count(*)::int AS total
      FROM filtered
    `;
    const totalResult = await query(totalSql, filters.values);

    return NextResponse.json({ items, total: totalResult.rows[0]?.total ?? 0 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
