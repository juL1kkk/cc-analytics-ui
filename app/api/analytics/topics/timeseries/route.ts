import { buildFilteredCte, parseAnalyticsFilters, resolveGranularity } from "@/lib/api/filters";
import { badRequest, internalError, zodErrorResponse } from "@/lib/api/responses";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (!searchParams.get("topic")) {
    return badRequest("Параметр topic обязателен.");
  }

  const parsed = parseAnalyticsFilters(searchParams);

  if (!parsed.ok) {
    return zodErrorResponse(parsed.error);
  }

  const granularity = resolveGranularity(parsed.data.period, searchParams.get("granularity"));
  const { sql, values } = buildFilteredCte(parsed.data);

  const statement = `${sql}
    SELECT
      date_trunc('${granularity}', started_at) AS t,
      count(*)::int AS incoming,
      count(*) FILTER (WHERE status = 'missed')::int AS missed
    FROM filtered
    GROUP BY 1
    ORDER BY 1;
  `;

  try {
    const { rows } = await query<{
      t: Date;
      incoming: number;
      missed: number;
    }>(statement, values);

    return Response.json({
      topic: parsed.data.topic ?? "all",
      items: rows.map((row) => ({
        t: row.t.toISOString(),
        incoming: row.incoming,
        missed: row.missed,
      })),
    });
  } catch (error) {
    console.error("Failed to load topic timeseries", error);
    return internalError();
  }
}
