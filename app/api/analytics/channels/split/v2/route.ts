import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveV2PeriodRange } from "@/lib/periodRange";

export const runtime = "nodejs";

type Row = {
  channel_code: string | null;
  channel_name: string | null;
  incoming: number;
  outgoing: number;
  response_sec: number;
};

type TrendRow = {
  t: string;
  channel_code: string;
  response_sec: number;
};

type QueueCodeRow = { code: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get("debug") === "1";

    const period = url.searchParams.get("period");
    const { from, to } = await resolveV2PeriodRange({
      period,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      fallbackFrom: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });

    const dept = url.searchParams.get("dept")?.trim() || null; // department uuid
    const queueRaw = url.searchParams.get("queue")?.trim() || null; // uuid или code
    const channelRaw = url.searchParams.get("channel")?.trim() || null; // uuid или code
    const q = url.searchParams.get("q")?.trim() || null;

    const channelId = channelRaw && UUID_RE.test(channelRaw) ? channelRaw : null;
    const channelCode = channelRaw && !UUID_RE.test(channelRaw) ? channelRaw.toLowerCase() : null;

    let queueCodeFilter: string | null = null;
    if (queueRaw) {
      if (UUID_RE.test(queueRaw)) {
        const queueCodeRes = await query<QueueCodeRow>(
          `select code from cc_replica."Queues" where id = $1::uuid limit 1`,
          [queueRaw],
        );
        queueCodeFilter = queueCodeRes.rows[0]?.code ?? null;
      } else {
        queueCodeFilter = queueRaw;
      }
    }

    const sql = `
  with
  call_split as (
    select
      ch.code as channel_code,
      coalesce(ch.name, ch.code) as channel_name,
      count(*) filter (where c."callDirection" = 'incoming')::int as incoming,
      count(*) filter (where c."callDirection" = 'outgoing')::int as outgoing
    from cc_replica."Call" c
    left join cc_replica."Channel" ch on ch.id = c.channel_id
    left join cc_replica."User" u on u.id = c.user_id
    left join cc_replica."Queues" q2 on q2.id = c.queue_id
    where c."createdOn" >= $1::timestamp
      and c."createdOn" <  $2::timestamp
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::text is null or q2.code = $4::text)
      and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
      and ($6::uuid is null or c.channel_id = $6::uuid)
      and ($7::text is null or lower(coalesce(ch.code, 'voice')) = $7::text)
      and coalesce(ch.code, 'voice') <> 'voice'          -- IMPORTANT: исключаем voice из Call
    group by ch.code, ch.name
  ),
  voice_split as (
    select
      'voice'::text as channel_code,
      'Звонки'::text as channel_name,
      count(*) filter (where f.direction = 'inbound')::int as incoming,
      count(*) filter (where f.direction = 'outbound')::int as outgoing
    from cc_replica."FsCdr" f
    left join cc_replica."Call" c on c.fs_uuid = f.id    -- чтобы применить dept/queue/q через Call
    left join cc_replica."User" u on u.id = c.user_id
    left join cc_replica."Channel" ch on ch.id = c.channel_id
    where f.start_stamp >= $1::timestamp
      and f.start_stamp <  $2::timestamp
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::text is null or f.queue_code = $4::text)
      and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
      and ($6::uuid is null or c.channel_id = $6::uuid)
      and ($7::text is null or lower(coalesce(ch.code, 'voice')) = $7::text)
      and ($7::text is null or $7::text = 'voice')
  ),
  split_counts as (
    select * from call_split
    union all
    select * from voice_split
  ),
  response_by_channel as (
    select
      lower(coalesce(ch.code, 'voice')) as channel_code,
      round(avg(extract(epoch from (f.answer_stamp - f.start_stamp))))::int as response_sec
    from cc_replica."FsCdr" f
    left join cc_replica."Call" c on c.fs_uuid = f.id
    left join cc_replica."User" u on u.id = c.user_id
    left join cc_replica."Channel" ch on ch.id = c.channel_id
    where f.start_stamp >= $1::timestamp
      and f.start_stamp <  $2::timestamp
      and f.direction = 'inbound'
      and f.answer_stamp is not null
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::text is null or f.queue_code = $4::text)
      and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
      and ($6::uuid is null or c.channel_id = $6::uuid)
      and ($7::text is null or lower(coalesce(ch.code, 'voice')) = $7::text)
    group by 1
  )
  select
    sc.channel_code,
    sc.channel_name,
    sc.incoming,
    sc.outgoing,
    coalesce(rbc.response_sec, 0)::int as response_sec
  from split_counts sc
  left join response_by_channel rbc on rbc.channel_code = lower(sc.channel_code)
  order by sc.incoming desc
`;

    const params = [from, to, dept, queueCodeFilter, q, channelId, channelCode];
    const { rows } = await query<Row>(sql, params);

    const trendSql = `
      select
        date_trunc('hour', f.start_stamp)::text as t,
        lower(coalesce(ch.code, 'voice')) as channel_code,
        round(avg(extract(epoch from (f.answer_stamp - f.start_stamp))))::int as response_sec
      from cc_replica."FsCdr" f
      left join cc_replica."Call" c on c.fs_uuid = f.id
      left join cc_replica."User" u on u.id = c.user_id
      left join cc_replica."Channel" ch on ch.id = c.channel_id
      where f.start_stamp >= $1::timestamp
        and f.start_stamp <  $2::timestamp
        and f.direction = 'inbound'
        and f.answer_stamp is not null
        and ($3::uuid is null or u.department_id = $3::uuid)
        and ($4::text is null or f.queue_code = $4::text)
        and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
        and ($6::uuid is null or c.channel_id = $6::uuid)
        and ($7::text is null or lower(coalesce(ch.code, 'voice')) = $7::text)
      group by 1, 2
      order by 1, 2
    `;

    const trendRes = await query<TrendRow>(trendSql, params);

    const split = rows.map((r) => ({
      channelCode: r.channel_code ?? "voice",
      channelNameRu: r.channel_name ?? r.channel_code ?? "Звонки",
      incoming: r.incoming,
      outgoing: r.outgoing,   // по контракту nullable, но int ок
      responseSec: r.response_sec ?? 0,
    }));

    const responseTrendMap = new Map<
      string,
      { t: string; voice?: number; chat?: number; email?: number; sms?: number; push?: number; value?: number }
    >();
    for (const row of trendRes.rows) {
      const cur = responseTrendMap.get(row.t) ?? { t: row.t };
      const value = row.response_sec ?? 0;

      if (channelCode && channelCode !== "all") {
        cur.value = value;
      } else {
        if (row.channel_code === "voice") cur.voice = value;
        if (row.channel_code === "chat") cur.chat = value;
        if (row.channel_code === "email") cur.email = value;
        if (row.channel_code === "sms") cur.sms = value;
        if (row.channel_code === "push") cur.push = value;
      }

      responseTrendMap.set(row.t, cur);
    }

    const responseTrend = Array.from(responseTrendMap.values());

    const body = { split, responseTrend };
    return NextResponse.json(
      debug
        ? { ...body, debug: { sql, params, trendSql, trendParams: params, queueCodeFilter } }
        : body,
    );
  } catch (error) {
    console.error("channels split v2 error", error);

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
