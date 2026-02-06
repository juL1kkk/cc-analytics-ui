import { buildFilteredCte, parseAnalyticsFilters } from "@/lib/api/filters";
import { internalError, zodErrorResponse } from "@/lib/api/responses";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseAnalyticsFilters(searchParams);

  if (!parsed.ok) {
    return zodErrorResponse(parsed.error);
  }

  const { sql, values } = buildFilteredCte(parsed.data);

  const statement = `${sql}
    SELECT
      channel_code,
      channel_name_ru,
      count(*)::int AS incoming,
      NULL::int AS outgoing,
      NULL::int AS response_sec
    FROM filtered
    GROUP BY channel_code, channel_name_ru
    ORDER BY incoming DESC;
  `;

  try {
    const { rows } = await query<{
      channel_code: string;
      channel_name_ru: string;
      incoming: number;
      outgoing: number | null;
      response_sec: number | null;
    }>(statement, values);

    return Response.json({
      split: rows.map((row) => ({
        channelCode: row.channel_code,
        channelNameRu: row.channel_name_ru,
        incoming: row.incoming,
        outgoing: row.outgoing,
        responseSec: row.response_sec,
      })),
      responseTrend: [],
    });
  } catch (error) {
    console.error("Failed to load channels split", error);
    return internalError();
  }
}
