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
  const topValues = [...values, parsedPagination.data.limit];

  const topStatement = `${sql}
    SELECT
      topic_id,
      topic_name_ru,
      count(*)::int AS count,
      round(avg(duration_sec) FILTER (WHERE status = 'completed' AND duration_sec > 0))::int AS avg_handle_sec,
      round(100.0 * count(*) FILTER (WHERE status = 'completed') / NULLIF(count(*), 0), 2) AS fcr_pct
    FROM filtered
    WHERE topic_id IS NOT NULL
    GROUP BY topic_id, topic_name_ru
    ORDER BY count DESC
    LIMIT $8;
  `;

  const channelStatement = `${sql}
    SELECT
      channel_name_ru,
      count(*)::float AS value
    FROM filtered
    GROUP BY channel_name_ru
    ORDER BY value DESC;
  `;

  try {
    const [topResult, channelResult] = await Promise.all([
      query<{
        topic_id: number;
        topic_name_ru: string;
        count: number;
        avg_handle_sec: number | null;
        fcr_pct: number | null;
      }>(topStatement, topValues),
      query<{
        channel_name_ru: string;
        value: number;
      }>(channelStatement, values),
    ]);

    return Response.json({
      topTopics: topResult.rows.map((row) => ({
        topicId: row.topic_id,
        topicNameRu: row.topic_name_ru,
        count: row.count,
        avgHandleSec: row.avg_handle_sec ?? null,
        fcrPct: row.fcr_pct ?? 0,
      })),
      channelSplit: channelResult.rows.map((row) => ({
        nameRu: row.channel_name_ru,
        value: row.value,
      })),
      sentimentSplit: null,
      goalSplit: null,
    });
  } catch (error) {
    console.error("Failed to load topics top", error);
    return internalError();
  }
}
