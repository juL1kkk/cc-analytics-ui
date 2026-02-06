import { buildFilteredCte, parseAnalyticsFilters, parsePagination } from "@/lib/api/filters";
import { internalError, zodErrorResponse } from "@/lib/api/responses";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedFilters = parseAnalyticsFilters(searchParams);

  if (!parsedFilters.ok) {
    return zodErrorResponse(parsedFilters.error);
  }

  const parsedPagination = parsePagination(searchParams);

  if (!parsedPagination.ok) {
    return zodErrorResponse(parsedPagination.error);
  }

  const { sql, values } = buildFilteredCte(parsedFilters.data);
  const paginationValues = [...values, parsedPagination.data.limit, parsedPagination.data.offset];

  const statement = `${sql}
    SELECT
      external_id,
      started_at,
      channel_code,
      channel_name_ru,
      queue_code,
      queue_name_ru,
      department_name_ru,
      operator_name_ru,
      topic_name_ru,
      duration_sec,
      status AS status_code,
      CASE status
        WHEN 'completed' THEN 'Завершён'
        WHEN 'missed' THEN 'Пропущен'
        WHEN 'waiting' THEN 'Ожидание'
        WHEN 'in_progress' THEN 'В разговоре'
      END AS status_ru,
      count(*) OVER()::int AS total_count
    FROM filtered
    ORDER BY started_at DESC
    LIMIT $8 OFFSET $9;
  `;

  try {
    const { rows } = await query<{
      external_id: string;
      started_at: Date;
      channel_code: string;
      channel_name_ru: string;
      queue_code: string;
      queue_name_ru: string;
      department_name_ru: string;
      operator_name_ru: string | null;
      topic_name_ru: string | null;
      duration_sec: number;
      status_code: string;
      status_ru: string;
      total_count: number;
    }>(statement, paginationValues);

    const total = rows[0]?.total_count ?? 0;

    return Response.json({
      items: rows.map((row) => ({
        externalId: row.external_id,
        startedAt: row.started_at.toISOString(),
        channelCode: row.channel_code,
        channelNameRu: row.channel_name_ru,
        queueCode: row.queue_code,
        queueNameRu: row.queue_name_ru,
        departmentNameRu: row.department_name_ru,
        operatorNameRu: row.operator_name_ru,
        topicNameRu: row.topic_name_ru,
        durationSec: row.duration_sec,
        statusCode: row.status_code,
        statusRu: row.status_ru,
      })),
      total,
    });
  } catch (error) {
    console.error("Failed to load recent interactions", error);
    return internalError();
  }
}
