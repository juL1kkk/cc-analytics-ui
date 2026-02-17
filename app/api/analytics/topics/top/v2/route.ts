import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveV2PeriodRange } from "@/lib/periodRange";
import { isUuid } from "@/lib/isUuid";

export const runtime = "nodejs";

type TopRow = {
  topic_id: number | string;
  topic_name: string;
  cnt: number;
  avg_handle_sec: number | null;
};

type SplitRow = {
  name_ru: string;
  value: number;
};

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

    const dept = url.searchParams.get("dept")?.trim() || null;
    const channel = url.searchParams.get("channel")?.trim() || null;
    const queue = url.searchParams.get("queue")?.trim() || null;
    const topic = url.searchParams.get("topic")?.trim() || null;
    const q = url.searchParams.get("q")?.trim() || null;
    const directionParam = (url.searchParams.get("direction")?.trim().toLowerCase() || "all") as
      | "in"
      | "out"
      | "all";
    const direction: "in" | "out" | "all" = ["in", "out", "all"].includes(directionParam)
      ? directionParam
      : "all";

    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10), 1), 50);

    const params: Array<string | Date | null> = [from, to, dept, queue, q, topic];
    const channelIsUuid = isUuid(channel);

    let channelJoinSql = "";
    let channelWhereSql = "";

    if (channel) {
      params.push(channel);
      const channelParamPos = params.length;

      if (channelIsUuid) {
        channelWhereSql = `and c.channel_id = $${channelParamPos}::uuid`;
      } else {
        channelJoinSql = `join cc_replica."Channel" ch_filter on ch_filter.id = c.channel_id`;
        channelWhereSql = `and ch_filter.code = $${channelParamPos}::text`;
      }
    }

    const includeIn = direction === "all" || direction === "in";
    const includeOut = direction === "all" || direction === "out";

    const topicInSql = `
      select
        ct.topic_id::text as topic_key,
        coalesce(ts.name, 'Не указано') as topic_name,
        f.billsec,
        f.answer_stamp
      from cc_replica."CallTopic" ct
      join cc_replica."Call" c on c.id = ct.call_id
      join cc_replica."FsCdr" f on f.id = c.fs_uuid
      left join cc_replica."User" u on u.id = c.user_id
      join cc_replica."TicketSubject" ts on ts.id = ct.topic_id
      ${channelJoinSql}
      where c."createdOn" >= $1::timestamp
        and c."createdOn" <  $2::timestamp
        and ($3::uuid is null or u.department_id = $3::uuid)
        and ($4::uuid is null or c.queue_id = $4::uuid)
        and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
        and (
          $6::text is null
          or $6::text = 'all'
          or ct.topic_id::text = $6::text
          or ts.name ilike '%' || $6 || '%'
        )
        and ct.dictionary = 'IN'
        and f.direction = 'inbound'
        ${channelWhereSql}
    `;

    const topicOutSql = `
      select
        ct.topic_id::text as topic_key,
        coalesce(tso.name, 'Не указано') as topic_name,
        f.billsec,
        f.answer_stamp
      from cc_replica."CallTopic" ct
      join cc_replica."Call" c on c.id = ct.call_id
      join cc_replica."FsCdr" f on f.id = c.fs_uuid
      left join cc_replica."User" u on u.id = c.user_id
      join cc_replica."TicketSubjectOut" tso on tso.id = ct.topic_id
      ${channelJoinSql}
      where c."createdOn" >= $1::timestamp
        and c."createdOn" <  $2::timestamp
        and ($3::uuid is null or u.department_id = $3::uuid)
        and ($4::uuid is null or c.queue_id = $4::uuid)
        and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
        and (
          $6::text is null
          or $6::text = 'all'
          or ct.topic_id::text = $6::text
          or tso.name ilike '%' || $6 || '%'
        )
        and ct.dictionary = 'OUT'
        and f.direction = 'outbound'
        ${channelWhereSql}
    `;

    const topicUnionSql = [includeIn ? topicInSql : null, includeOut ? topicOutSql : null]
      .filter(Boolean)
      .join(" union all ");

    const topSql = `
      with topic_rows as (
        ${topicUnionSql || "select null::text as topic_key, null::text as topic_name, null::int as billsec, null::timestamp as answer_stamp where false"}
      )
      select
        (dense_rank() over (order by tr.topic_name))::int as topic_id,
        tr.topic_name,
        count(*)::int as cnt,
        round(avg(case when tr.answer_stamp is not null then tr.billsec end))::int as avg_handle_sec
      from topic_rows tr
      group by tr.topic_name
      order by cnt desc
      limit $${params.length + 1}
    `;

    const splitSql = `
      select
        coalesce(ch.name, ch.code, 'Не указано') as name_ru,
        count(*)::float as value
      from cc_replica."Call" c
      left join cc_replica."User" u on u.id = c.user_id
      left join cc_replica."Channel" ch on ch.id = c.channel_id
      ${channelJoinSql}
      where c."createdOn" >= $1::timestamp
        and c."createdOn" <  $2::timestamp
        and ($3::uuid is null or u.department_id = $3::uuid)
        and ($4::uuid is null or c.queue_id = $4::uuid)
        and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
        ${channelWhereSql}
      group by 1
      order by value desc
    `;

    const goalSql = `
      select
        tr.name as name_ru,
        count(*)::float as value
      from cc_replica."CallResult" cr
      join cc_replica."TicketResult" tr on tr.id = cr."ticketResult_id"
      join cc_replica."Call" c on c.id = cr.call_id
      join cc_replica."FsCdr" f on f.id = c.fs_uuid
      left join cc_replica."User" u on u.id = c.user_id
      ${channelJoinSql}
      where c."createdOn" >= $1::timestamp
        and c."createdOn" <  $2::timestamp
        and ($3::uuid is null or u.department_id = $3::uuid)
        and ($4::uuid is null or c.queue_id = $4::uuid)
        and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
        ${channelWhereSql}
      group by 1
      order by value desc
    `;

    const topRes = await query<TopRow>(topSql, [...params, limit]);
    const splitRes = await query<SplitRow>(splitSql, params);
    const goalRes = await query<SplitRow>(goalSql, params);

    const topTopics = topRes.rows.map((r) => ({
      topicId: Number(r.topic_id),
      topicNameRu: r.topic_name,
      count: r.cnt,
      avgHandleSec: r.avg_handle_sec ?? null,
      fcrPct: 0.0,
    }));

    const channelSplit = splitRes.rows.map((r) => ({
      nameRu: r.name_ru,
      value: r.value,
    }));

    const goalSplit = goalRes.rows.map((r) => ({
      nameRu: r.name_ru,
      value: r.value,
    }));

    const body = {
      topTopics,
      channelSplit,
      sentimentSplit: null,
      goalSplit,
    };

    return NextResponse.json(
      debug
        ? {
            ...body,
            debug: {
              topSql,
              splitSql,
              goalSql,
              params,
              limit,
              direction,
              channel,
              channelIsUuid,
            },
          }
        : body,
    );
  } catch (error) {
    console.error("topics top v2 error", error);

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
