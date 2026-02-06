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
      queue_code,
      queue_name_ru,
      count(*)::int AS total,
      round(100.0 * count(*) FILTER (WHERE status = 'missed') / NULLIF(count(*), 0), 2) AS abandoned_pct,
      NULL::int AS waiting,
      NULL::int AS avg_wait_sec,
      NULL::numeric AS sla_pct
    FROM filtered
    GROUP BY queue_code, queue_name_ru
    ORDER BY total DESC;
  `;

  try {
    const { rows } = await query<{
      queue_code: string;
      queue_name_ru: string;
      total: number;
      abandoned_pct: number | null;
      waiting: number | null;
      avg_wait_sec: number | null;
      sla_pct: number | null;
    }>(statement, values);

    return Response.json({
      items: rows.map((row) => ({
        queueCode: row.queue_code,
        queueNameRu: row.queue_name_ru,
        total: row.total,
        abandonedPct: row.abandoned_pct ?? null,
        waiting: row.waiting ?? null,
        avgWaitSec: row.avg_wait_sec ?? null,
        slaPct: row.sla_pct ?? null,
      })),
      queueDepthTrend: null,
    });
  } catch (error) {
    console.error("Failed to load queues analytics", error);
    return internalError();
  }
}
