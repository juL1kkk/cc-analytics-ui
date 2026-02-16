import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type SummaryRow = {
  on_line: number;
  waiting: number;
  unavailable: number;
  total: number;
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

  if (period === "today") {
    start.setDate(start.getDate() - 1);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 30);
  } else {
    return null;
  }

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

    const from = fromQ ?? range?.from ?? new Date(Date.now() - 24 * 3600 * 1000);
    const to = toQ ?? range?.to ?? new Date();

    const dept = url.searchParams.get("dept")?.trim() || null;
    const queue = url.searchParams.get("queue")?.trim() || null;

    const sql = `
      with latest as (
        select distinct on (ase.agent_login)
          ase.agent_login,
          ase.state
        from cc_replica."AgentStateEvent" ase
        left join cc_replica."User" u on u.id = ase.user_id
        where ase.ts >= $1::timestamptz
          and ase.ts <  $2::timestamptz
          and ($3::uuid is null or (ase.user_id is not null and u.department_id = $3::uuid))
          and ($4::text is null or ase.queue_code = $4)
        order by ase.agent_login, ase.ts desc, ase.id desc
      )
      select
        count(*) filter (where state = 'AVAILABLE')::int as on_line,
        count(*) filter (where state = 'BUSY')::int as waiting,
        count(*) filter (where state in ('NOT_READY', 'OFFLINE'))::int as unavailable,
        count(*)::int as total
      from latest
    `;

    const params = [from, to, dept, queue];
    const res = await query<SummaryRow>(sql, params);

    const row = res.rows[0] ?? {
      on_line: 0,
      waiting: 0,
      unavailable: 0,
      total: 0,
    };

    const body = {
      onLine: row.on_line ?? 0,
      waiting: row.waiting ?? 0,
      unavailable: row.unavailable ?? 0,
      total: row.total ?? 0,
    };

    return NextResponse.json(debug ? { ...body, debug: { sql, params } } : body);
  } catch (error) {
    console.error("agent-state summary v2 error", error);

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
