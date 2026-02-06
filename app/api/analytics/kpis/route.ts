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
      count(*)::int AS incoming,
      count(*) FILTER (WHERE status = 'missed')::int AS missed,
      round(avg(duration_sec) FILTER (WHERE status = 'completed' AND duration_sec > 0))::int AS aht_sec,
      count(DISTINCT operator_id) FILTER (WHERE operator_id IS NOT NULL)::int AS operators_on_calls,
      (SELECT count(*) FROM operators WHERE is_active = true)::int AS operators_total,
      round(100.0 * count(*) FILTER (WHERE status = 'completed') / NULLIF(count(*), 0), 2) AS fcr_pct,
      NULL::int AS avg_wait_sec,
      NULL::numeric AS sla_pct
    FROM filtered;
  `;

  try {
    const { rows } = await query<{
      incoming: number;
      missed: number;
      aht_sec: number | null;
      operators_on_calls: number;
      operators_total: number;
      fcr_pct: number | null;
      avg_wait_sec: number | null;
      sla_pct: number | null;
    }>(statement, values);

    const row = rows[0];

    return Response.json({
      incoming: row?.incoming ?? 0,
      missed: row?.missed ?? 0,
      ahtSec: row?.aht_sec ?? null,
      operatorsOnCalls: row?.operators_on_calls ?? 0,
      operatorsTotal: row?.operators_total ?? 0,
      fcrPct: row?.fcr_pct ?? 0,
      avgWaitSec: row?.avg_wait_sec ?? null,
      slaPct: row?.sla_pct ?? null,
    });
  } catch (error) {
    console.error("Failed to load KPIs", error);
    return internalError();
  }
}
