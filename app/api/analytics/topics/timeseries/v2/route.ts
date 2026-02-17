import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveV2PeriodRange } from "@/lib/periodRange";
import { isUuid } from "@/lib/isUuid";

export const runtime = "nodejs";

type Row = {
  t: string;
  incoming: number;
  missed: number;
};

type QueueCodeRow = { code: string };

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

    const topicRaw = url.searchParams.get("topic")?.trim() || null;
    const topic = !topicRaw || topicRaw.toLowerCase() === "all" ? "all" : topicRaw;

    if (topic !== "all" && !isUuid(topic)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "topic must be uuid or 'all'" } },
        { status: 400 },
      );
    }

    const directionRaw = (url.searchParams.get("direction")?.trim().toLowerCase() || "all") as
      | "in"
      | "out"
      | "all";
    const direction: "in" | "out" | "all" = ["in", "out", "all"].includes(directionRaw)
      ? directionRaw
      : "all";

    const dept = url.searchParams.get("dept")?.trim() || null;
    const channelRaw = (url.searchParams.get("channel") ?? "").trim();
    const queueRaw = url.searchParams.get("queue")?.trim() || null;
    const q = url.searchParams.get("q")?.trim() || null;

    const channelId = isUuid(channelRaw) ? channelRaw : null;
    const channelCode = channelRaw && !channelId ? channelRaw.toLowerCase() : null;

    let queueCodeFilter: string | null = null;
    if (queueRaw) {
      if (isUuid(queueRaw)) {
        const queueCodeRes = await query<QueueCodeRow>(
          `select code from cc_replica."Queues" where id = $1::uuid limit 1`,
          [queueRaw],
        );
        queueCodeFilter = queueCodeRes.rows[0]?.code ?? null;
      } else {
        queueCodeFilter = queueRaw;
      }
    }

    const params: Array<string | Date | null> = [
      from,
      to,
      dept,
      queueCodeFilter,
      q,
      channelId,
      channelCode,
      topic === "all" ? null : topic,
    ];

    const baseFilters = `
      f.start_stamp >= $1::timestamptz
      and f.start_stamp <  $2::timestamptz
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::text is null or f.queue_code = $4::text)
      and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
      and ($6::uuid is null or c.channel_id = $6::uuid)
      and ($7::text is null or lower(coalesce(ch.code, 'voice')) = $7::text)
      and ($8::text is null or ct.topic_id::text = $8::text)
    `;

    const inSql = `
      select
        date_trunc('hour', f.start_stamp) as t,
        1::int as incoming,
        (case when f.answer_stamp is null then 1 else 0 end)::int as missed
      from cc_replica."CallTopic" ct
      join cc_replica."Call" c on c.id = ct.call_id
      join cc_replica."FsCdr" f on f.id = c.fs_uuid
      left join cc_replica."User" u on u.id = c.user_id
      left join cc_replica."Channel" ch on ch.id = c.channel_id
      join cc_replica."TicketSubject" ts on ts.id = ct.topic_id
      where ${baseFilters}
        and ct.dictionary = 'IN'
        and f.direction = 'inbound'
    `;

    const outSql = `
      select
        date_trunc('hour', f.start_stamp) as t,
        1::int as incoming,
        (case when f.answer_stamp is null then 1 else 0 end)::int as missed
      from cc_replica."CallTopic" ct
      join cc_replica."Call" c on c.id = ct.call_id
      join cc_replica."FsCdr" f on f.id = c.fs_uuid
      left join cc_replica."User" u on u.id = c.user_id
      left join cc_replica."Channel" ch on ch.id = c.channel_id
      join cc_replica."TicketSubjectOut" tso on tso.id = ct.topic_id
      where ${baseFilters}
        and ct.dictionary = 'OUT'
        and f.direction = 'outbound'
    `;

    const unionSql =
      direction === "in"
        ? inSql
        : direction === "out"
          ? outSql
          : `${inSql}\nunion all\n${outSql}`;

    const sql = `
      with topic_rows as (
        ${unionSql}
      )
      select
        tr.t,
        count(*)::int as incoming,
        sum(tr.missed)::int as missed
      from topic_rows tr
      group by tr.t
      order by tr.t asc
    `;

    const { rows } = await query<Row>(sql, params);

    const items = rows.map((r) => ({
      t: new Date(r.t).toISOString(),
      incoming: r.incoming,
      missed: r.missed,
    }));

    const body = { topic, items };
    return NextResponse.json(
      debug
        ? {
            ...body,
            debug: {
              sql,
              params,
              direction,
              queueCodeFilter,
              channelId,
              channelCode,
            },
          }
        : body,
    );
  } catch (error) {
    console.error("topics timeseries v2 error", error);

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
