import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type Row = {
  external_id: string | null;
  started_at: string;
  channel_code: string | null;
  channel_name: string | null;
  queue_code: string | null;
  queue_name: string | null;
  dept_name: string | null;
  operator_name: string | null;
  topic_name: string | null;
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

function toInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v ?? "");
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
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

    // В v2 фильтры uuid (по связям Call)
    const dept = url.searchParams.get("dept")?.trim() || null;     // department_id uuid
    const channel = url.searchParams.get("channel")?.trim() || null; // channel_id uuid
    const queue = url.searchParams.get("queue")?.trim() || null;     // queue_id uuid
    const q = url.searchParams.get("q")?.trim() || null;

    const limit = toInt(url.searchParams.get("limit"), 50, 1, 200);
    const offset = toInt(url.searchParams.get("offset"), 0, 0, 1_000_000);

    const whereSql = `
      c."createdOn" >= $1::timestamp
      and c."createdOn" <  $2::timestamp
      and ($3::uuid is null or c.channel_id = $3::uuid)
      and ($4::uuid is null or c.queue_id = $4::uuid)
      and ($5::uuid is null or u.department_id = $5::uuid)
      and ($6::text is null or c."requestNum" ilike '%' || $6 || '%')
    `;

    const sql = `
      select
        c."requestNum" as external_id,
        c."createdOn" as started_at,
        ch.code as channel_code,
        ch.name as channel_name,
        q2.code as queue_code,
        q2.name as queue_name,
        d.name as dept_name,
        u.name as operator_name,
        coalesce(ts.name, tso.name) as topic_name
      from cc_replica."Call" c
      left join cc_replica."Channel" ch on ch.id = c.channel_id
      left join cc_replica."Queues" q2 on q2.id = c.queue_id
      left join cc_replica."User" u on u.id = c.user_id
      left join cc_replica."Department" d on d.id = u.department_id
      left join cc_replica."TicketSubject" ts on ts.id = c."ticketSubject_id"
      left join cc_replica."TicketSubjectOut" tso on tso.id = c."ticketSubjectOut_id"
      where ${whereSql}
      order by c."createdOn" desc
      limit $7 offset $8
    `;

    const countSql = `
      select count(*)::int as total
      from cc_replica."Call" c
      left join cc_replica."User" u on u.id = c.user_id
      where ${whereSql}
    `;

    const params = [from, to, channel, queue, dept, q];

    const totalRes = await query<{ total: number }>(countSql, params);
    const total = totalRes.rows[0]?.total ?? 0;

    const dataRes = await query<Row>(sql, [...params, limit, offset]);
    const items = dataRes.rows.map((r) => ({
      externalId: r.external_id ?? "",
      startedAt: new Date(r.started_at).toISOString(),
      channelCode: (r.channel_code ?? "voice") as any,
      channelNameRu: r.channel_name ?? r.channel_code ?? "Звонки",
      queueCode: r.queue_code ?? "",
      queueNameRu: r.queue_name ?? r.queue_code ?? "",
      departmentNameRu: r.dept_name ?? "",
      operatorNameRu: r.operator_name ?? null,
      topicNameRu: r.topic_name ?? null,
      durationSec: 0,
      statusCode: "completed",
      statusRu: "Завершён",
    }));

    const body = { items, total };
    return NextResponse.json(debug ? { ...body, debug: { sql, countSql, params, limit, offset } } : body);
  } catch (error) {
    console.error("recent v2 error", error);

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
