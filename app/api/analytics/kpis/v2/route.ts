import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type Row = {
  incoming: number;
  missed: number;
  completed: number;
  aht_sec: number;
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

    const channel = url.searchParams.get("channel")?.trim() || null; // channel code (voice/chat/...)
    const dept = url.searchParams.get("dept")?.trim() || null; // department uuid
    const queue = url.searchParams.get("queue")?.trim() || null; // queue uuid
    const operator = url.searchParams.get("operator")?.trim() || null; // user uuid
    const topic = url.searchParams.get("topic")?.trim() || null; // ticket subject uuid
    const q = url.searchParams.get("q")?.trim() || null; // request number search

    const sql = `
      with filtered_calls as (
        select
          c.*,
          ch.code as channel_code,
          (
            lower(coalesce(to_jsonb(c)->>'completed', 'false')) = 'true'
            or lower(coalesce(to_jsonb(c)->>'status', '')) = 'completed'
          ) as completed_flag,
          case
            when coalesce(to_jsonb(c)->>'handle_sec', '') ~ '^-?\\d+(\\.\\d+)?$'
              then (to_jsonb(c)->>'handle_sec')::numeric
            else null
          end as handle_sec_num
        from cc_replica."Call" c
        left join cc_replica."Channel" ch on ch.id = c.channel_id
        left join cc_replica."User" u on u.id = c.user_id
        where c."createdOn" >= $1::timestamptz
          and c."createdOn" <  $2::timestamptz
          and ($4::uuid is null or u.department_id = $4::uuid)
          and ($5::uuid is null or c.queue_id = $5::uuid)
          and ($6::uuid is null or c.user_id = $6::uuid)
          and (
            $7::uuid is null
            or c."ticketSubject_id" = $7::uuid
            or c."ticketSubjectOut_id" = $7::uuid
          )
          and ($8::text is null or c."requestNum" ilike '%' || $8 || '%')
      ),
      voice_kpi as (
        select
          count(*) filter (where f.direction = 'inbound')::int as incoming,
          count(*) filter (where f.direction = 'inbound' and f.answer_stamp is null)::int as missed,
          count(*) filter (where f.direction = 'inbound' and f.answer_stamp is not null)::int as completed,
          coalesce(sum(f.billsec) filter (where f.direction = 'inbound' and f.answer_stamp is not null), 0)::numeric as aht_sum,
          count(*) filter (where f.direction = 'inbound' and f.answer_stamp is not null)::int as aht_count,
          count(*) filter (where f.direction = 'inbound')::int as total
        from cc_replica."FsCdr" f
        left join filtered_calls c on c.fs_uuid = f.id
        where f.start_stamp >= $1::timestamptz
          and f.start_stamp <  $2::timestamptz
          and ($4::uuid is null or c.department_id = $4::uuid)
          and ($5::uuid is null or c.queue_id = $5::uuid)
          and ($6::uuid is null or c.user_id = $6::uuid)
          and (
            $7::uuid is null
            or c."ticketSubject_id" = $7::uuid
            or c."ticketSubjectOut_id" = $7::uuid
          )
          and ($8::text is null or c."requestNum" ilike '%' || $8 || '%')
      ),
      call_kpi as (
        select
          count(*)::int as incoming,
          0::int as missed,
          count(*) filter (where c.completed_flag)::int as completed,
          coalesce(sum(c.handle_sec_num), 0)::numeric as aht_sum,
          count(c.handle_sec_num)::int as aht_count,
          count(*)::int as total
        from filtered_calls c
        where coalesce(c.channel_code, 'voice') <> 'voice'
          and ($3::text is null or c.channel_code = $3::text)
      ),
      selected as (
        select * from voice_kpi where $3::text = 'voice'
        union all
        select * from call_kpi where $3::text is not null and $3::text <> 'voice'
        union all
        select * from voice_kpi where $3::text is null
        union all
        select * from call_kpi where $3::text is null
      )
      select
        coalesce(sum(incoming), 0)::int as incoming,
        coalesce(sum(missed), 0)::int as missed,
        coalesce(sum(completed), 0)::int as completed,
        coalesce(round(sum(aht_sum) / nullif(sum(aht_count), 0))::int, 0) as aht_sec,
        coalesce(sum(total), 0)::int as total
      from selected
    `;

    const params = [from, to, channel, dept, queue, operator, topic, q];
    const { rows } = await query<Row>(sql, params);
    const r = rows[0] ?? { incoming: 0, missed: 0, completed: 0, aht_sec: 0, total: 0 };

    const body = {
      incoming: r.incoming,
      missed: r.missed,
      completed: r.completed,
      ahtSec: r.aht_sec,
      total: r.total,
    };

    return NextResponse.json(debug ? { ...body, debug: { sql, params } } : body);
  } catch (error) {
    console.error("kpis v2 error", error);

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
