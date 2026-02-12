import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type CallsAggRow = {
  queue_code: string;
  queue_name: string;
  total: number;
};

type CdrAggRow = {
  queue_code: string | null;
  inbound_total: number;
  missed: number;
};

function parseDate(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function periodToRange(period: string | null) {
  const now = new Date();
  const end = now;
  const start = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  else if (period === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
  } else if (period === "7d") start.setDate(start.getDate() - 7);
  else if (period === "30d") start.setDate(start.getDate() - 30);
  else return null;
  return { from: start, to: end };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get("debug") === "1";

    const period = url.searchParams.get("period");
    const fromQ = parseDate(url.searchParams.get("from"));
    const toQ = parseDate(url.searchParams.get("to"));
    const range = periodToRange(period);

    const from = fromQ ?? range?.from ?? new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = toQ ?? range?.to ?? new Date();

    const dept = url.searchParams.get("dept")?.trim() || null;  // uuid
    const queueId = url.searchParams.get("queue")?.trim() || null; // uuid (для Call/Queues)
    const q = url.searchParams.get("q")?.trim() || null;

    // 1) totals по Calls (+ справочник Queues)
    const callsSql = `
      select
        q2.code as queue_code,
        q2.name as queue_name,
        count(c.id)::int as total
      from cc_replica."Queues" q2
      left join cc_replica."Call" c on c.queue_id = q2.id
      left join cc_replica."User" u on u.id = c.user_id
      where ($1::uuid is null or q2.id = $1::uuid)
        and (c.id is null or (
          c."createdOn" >= $2::timestamp
          and c."createdOn" <  $3::timestamp
          and ($4::uuid is null or u.department_id = $4::uuid)
          and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
        ))
      group by q2.code, q2.name
      order by total desc
    `;

    const callsParams = [queueId, from, to, dept, q];
    const callsRes = await query<CallsAggRow>(callsSql, callsParams);

    // 2) abandonedPct по FsCdr (queue_code строковый)
    // Если queueId задан, попробуем взять queue_code из callsRes (потому что id→code)
    const queueCode = queueId ? callsRes.rows[0]?.queue_code ?? null : null;

    const cdrSql = `
      select
        queue_code,
        count(*) filter (where direction = 'inbound')::int as inbound_total,
        count(*) filter (where direction = 'inbound' and answer_stamp is null)::int as missed
      from cc_replica."FsCdr"
      where start_stamp >= $1::timestamptz
        and start_stamp <  $2::timestamptz
        and ($3::text is null or queue_code = $3)
      group by queue_code
    `;

    const cdrParams = [from, to, queueCode];
    const cdrRes = await query<CdrAggRow>(cdrSql, cdrParams);

    const cdrByCode = new Map<string, { inbound_total: number; missed: number }>();
    for (const r of cdrRes.rows) {
      if (!r.queue_code) continue;
      cdrByCode.set(r.queue_code, { inbound_total: r.inbound_total, missed: r.missed });
    }

    const items = callsRes.rows.map((r) => {
      const cdr = cdrByCode.get(r.queue_code);
      const inboundTotal = cdr?.inbound_total ?? 0;
      const missed = cdr?.missed ?? 0;

      const abandonedPct =
        inboundTotal > 0 ? Math.round(((missed / inboundTotal) * 100) * 10) / 10 : null;

      return {
        queueCode: r.queue_code,
        queueNameRu: r.queue_name,
        total: r.total,
        abandonedPct,
        waiting: null,
        avgWaitSec: null,
        slaPct: null,
      };
    });

    const body = { items, queueDepthTrend: null };
    return NextResponse.json(
      debug ? { ...body, debug: { callsSql, callsParams, cdrSql, cdrParams } } : body,
    );
  } catch (error) {
    console.error("queues v2 error", error);

    const url = new URL(request.url);
    const wantDetails = url.searchParams.get("debug") === "1";

    const details = wantDetails
      ? error instanceof Error
        ? error.message
        : String(error)
      : undefined;

    return NextResponse.json(
      {
        error: {
          code: "DB_ERROR",
          message: "Database error",
          ...(details ? { details } : {}),
        },
      },
      { status: 500 },
    );
  }
}
