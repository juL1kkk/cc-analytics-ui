import {
  buildFilteredCte,
  parseAnalyticsFilters,
  parsePagination,
  resolveGranularity,
} from "@/lib/api/filters";
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

  const granularity = resolveGranularity(parsedFilters.data.period, searchParams.get("granularity"));
  const { sql, values } = buildFilteredCte(parsedFilters.data);
  const paginationValues = [...values, parsedPagination.data.limit, parsedPagination.data.offset];

  const itemsStatement = `${sql}
    SELECT
      operator_id,
      operator_name_ru,
      count(*) FILTER (WHERE status <> 'missed')::int AS handled,
      count(*) FILTER (WHERE status = 'missed')::int AS missed,
      round(avg(duration_sec) FILTER (WHERE duration_sec > 0 AND status = 'completed'))::int AS aht_sec,
      round(100.0 * count(*) FILTER (WHERE status = 'completed') / NULLIF(count(*), 0), 2) AS fcr_pct
    FROM filtered
    WHERE operator_id IS NOT NULL
    GROUP BY operator_id, operator_name_ru
    ORDER BY handled DESC NULLS LAST
    LIMIT $8 OFFSET $9;
  `;

  const trendStatement = `${sql}
    SELECT
      date_trunc('${granularity}', started_at) AS t,
      round(avg(duration_sec) FILTER (WHERE status = 'completed' AND duration_sec > 0))::int AS aht_sec,
      NULL::int AS asa_sec
    FROM filtered
    GROUP BY 1
    ORDER BY 1;
  `;

  try {
    const [itemsResult, trendResult] = await Promise.all([
      query<{
        operator_id: number;
        operator_name_ru: string;
        handled: number;
        missed: number;
        aht_sec: number | null;
        fcr_pct: number | null;
      }>(itemsStatement, paginationValues),
      query<{
        t: Date;
        aht_sec: number | null;
        asa_sec: number | null;
      }>(trendStatement, values),
    ]);

    return Response.json({
      items: itemsResult.rows.map((row) => ({
        operatorId: row.operator_id,
        operatorNameRu: row.operator_name_ru,
        handled: row.handled,
        missed: row.missed,
        ahtSec: row.aht_sec ?? null,
        fcrPct: row.fcr_pct ?? 0,
      })),
      trend: trendResult.rows.map((row) => ({
        t: row.t.toISOString(),
        ahtSec: row.aht_sec ?? null,
        asaSec: row.asa_sec ?? null,
      })),
    });
  } catch (error) {
    console.error("Failed to load operators analytics", error);
    return internalError();
  }
}
