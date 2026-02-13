import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type Row = {
  channel_code: string | null;
  channel_name: string | null;
  incoming: number;
  outgoing: number;
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

    const dept = url.searchParams.get("dept")?.trim() || null;   // department uuid
    const queue = url.searchParams.get("queue")?.trim() || null; // queue uuid
    const q = url.searchParams.get("q")?.trim() || null;

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
    where c."createdOn" >= $1::timestamp
      and c."createdOn" <  $2::timestamp
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::uuid is null or c.queue_id = $4::uuid)
      and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
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
    where f.start_stamp >= $1::timestamp
      and f.start_stamp <  $2::timestamp
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::uuid is null or c.queue_id = $4::uuid)
      and ($5::text is null or c."requestNum" ilike '%' || $5 || '%')
  )
  select * from call_split
  union all
  select * from voice_split
  order by incoming desc
`;


    const params = [from, to, dept, queue, q];
    const { rows } = await query<Row>(sql, params);

    const split = rows.map((r) => ({
      channelCode: (r.channel_code ?? "voice") as any,
      channelNameRu: r.channel_name ?? r.channel_code ?? "Звонки",
      incoming: r.incoming,
      outgoing: r.outgoing,   // по контракту nullable, но int ок
      responseSec: null,
    }));

    const body = { split, responseTrend: [] };
    return NextResponse.json(debug ? { ...body, debug: { sql, params } } : body);
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
