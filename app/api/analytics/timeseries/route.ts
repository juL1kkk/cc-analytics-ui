import { buildFilteredCte, parseAnalyticsFilters, resolveGranularity } from "@/lib/api/filters";
import { internalError, zodErrorResponse } from "@/lib/api/responses";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
      count(*) FILTER (WHERE status = 'missed')::int AS missed,
      round(avg(duration_sec) FILTER (WHERE status = 'completed' AND duration_sec > 0))::int AS aht_sec
    FROM filtered
    GROUP BY 1
    ORDER BY 1;
  `;

  try {
    const { rows } = await query<{
      t: Date;
      incoming: number;
      missed: number;
      aht_sec: number | null;
    }>(statement, values);

    return Response.json({
      granularity,
      items: rows.map((row) => ({
        t: row.t.toISOString(),
        incoming: row.incoming,
        missed: row.missed,
        ahtSec: row.aht_sec ?? null,
      })),
    });
  } catch (error) {
    console.error("Failed to load timeseries", error);
    return internalError();
  }
}
