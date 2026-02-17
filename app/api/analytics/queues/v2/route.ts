import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveV2PeriodRange } from "@/lib/periodRange";

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
  waiting: number;
  avg_wait_sec: number;
  sla_pct: number;
};

type TrendRow = {
  t: string;
  value: number;
};

type QueueCodeRow = {
  code: string;
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

    const dept = url.searchParams.get("dept")?.trim() || null; // uuid
    const queueId = url.searchParams.get("queue")?.trim() || null; // uuid
    const q = url.searchParams.get("q")?.trim() || null;

    const slaSecRaw = Number(url.searchParams.get("slaSec") ?? "20");
    const slaSec = Number.isFinite(slaSecRaw) && slaSecRaw >= 0 ? Math.floor(slaSecRaw) : 20;

    let queueCodeFilter: string | null = null;
    if (queueId) {
      const queueCodeRes = await query<QueueCodeRow>(
        `select code from cc_replica."Queues" where id = $1::uuid limit 1`,
        [queueId],
      );
      queueCodeFilter = queueCodeRes.rows[0]?.code ?? null;
    }

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

    const cdrSql = `
      with base as (
        select
          f.queue_code,
          f.start_stamp,
          f.answer_stamp,
          extract(epoch from (f.answer_stamp - f.start_stamp)) as wait_sec
        from cc_replica."FsCdr" f
        left join cc_replica."Call" c on c.fs_uuid = f.id
        left join cc_replica."User" u on u.id = c.user_id
        where f.direction = 'inbound'
          and ($1::uuid is null or u.department_id = $1::uuid)
          and ($2::text is null or f.queue_code = $2)
      )
      select
        queue_code,
        count(*) filter (where start_stamp >= $3::timestamptz and start_stamp < $4::timestamptz)::int as inbound_total,
        count(*) filter (
          where start_stamp >= $3::timestamptz
            and start_stamp < $4::timestamptz
            and answer_stamp is null
        )::int as missed,
        count(*) filter (
          where start_stamp < $4::timestamptz
            and (answer_stamp is null or answer_stamp >= $4::timestamptz)
        )::int as waiting,
        coalesce(
          round(avg(wait_sec) filter (
            where start_stamp >= $3::timestamptz
              and start_stamp < $4::timestamptz
              and answer_stamp is not null
          ))::int,
          0
        )::int as avg_wait_sec,
        coalesce(
          round(
            100.0 * (
              count(*) filter (
                where start_stamp >= $3::timestamptz
                  and start_stamp < $4::timestamptz
                  and answer_stamp is not null
                  and wait_sec <= $5::int
              )
            )
            / nullif(
              count(*) filter (
                where start_stamp >= $3::timestamptz
                  and start_stamp < $4::timestamptz
                  and answer_stamp is not null
              ),
              0
            )
          )::int,
          0
        )::int as sla_pct
      from base
      group by queue_code
    `;

    const cdrParams = [dept, queueCodeFilter, from, to, slaSec];
    const cdrRes = await query<CdrAggRow>(cdrSql, cdrParams);

    const cdrByCode = new Map<string, Omit<CdrAggRow, "queue_code">>();
    for (const r of cdrRes.rows) {
      if (!r.queue_code) continue;
      cdrByCode.set(r.queue_code, {
        inbound_total: r.inbound_total,
        missed: r.missed,
        waiting: r.waiting,
        avg_wait_sec: r.avg_wait_sec,
        sla_pct: r.sla_pct,
      });
    }

    const trendSql = `
      with series as (
        select generate_series(
          date_trunc('hour', $3::timestamptz),
          date_trunc('hour', $4::timestamptz),
          interval '1 hour'
        ) as t
      ),
      base as (
        select
          f.start_stamp,
          f.answer_stamp
        from cc_replica."FsCdr" f
        left join cc_replica."Call" c on c.fs_uuid = f.id
        left join cc_replica."User" u on u.id = c.user_id
        where f.direction = 'inbound'
          and ($1::uuid is null or u.department_id = $1::uuid)
          and ($2::text is null or f.queue_code = $2)
          and f.start_stamp < ($4::timestamptz + interval '1 hour')
          and (f.answer_stamp is null or f.answer_stamp >= $3::timestamptz)
      )
      select
        s.t::text as t,
        count(*) filter (
          where b.start_stamp < (s.t + interval '1 hour')
            and (b.answer_stamp is null or b.answer_stamp >= (s.t + interval '1 hour'))
        )::int as value
      from series s
      left join base b on true
      group by s.t
      order by s.t
    `;

    const trendParams = [dept, queueCodeFilter, from, to];
    const trendRes = await query<TrendRow>(trendSql, trendParams);

    const items = callsRes.rows.map((r) => {
      const cdr = cdrByCode.get(r.queue_code);
      const inboundTotal = cdr?.inbound_total ?? 0;
      const missed = cdr?.missed ?? 0;

      const abandonedPct = inboundTotal > 0 ? Math.round((missed / inboundTotal) * 1000) / 10 : null;

      return {
        queueCode: r.queue_code,
        queueNameRu: r.queue_name,
        total: r.total,
        abandonedPct,
        waiting: cdr?.waiting ?? 0,
        avgWaitSec: cdr?.avg_wait_sec ?? 0,
        slaPct: cdr?.sla_pct ?? 0,
      };
    });

    const queueDepthTrend = trendRes.rows.map((row) => ({
      t: row.t,
      value: row.value ?? 0,
    }));

    const body = { items, queueDepthTrend };
    return NextResponse.json(
      debug
        ? {
            ...body,
            debug: {
              queueCodeFilter,
              callsSql,
              callsParams,
              cdrSql,
              cdrParams,
              trendSql,
              trendParams,
            },
          }
        : body,
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
