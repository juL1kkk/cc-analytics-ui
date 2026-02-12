import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type Row = { color: string | null; total: number };

const COLOR_MAP: Record<string, string> = {
  red: "Негатив",
  yellow: "Нейтрально",
  green: "Позитив",
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

    const channel = url.searchParams.get("channel")?.trim() || null; // uuid
    const queue = url.searchParams.get("queue")?.trim() || null;     // uuid
    const q = url.searchParams.get("q")?.trim() || null;

    const sql = `
      select
        w."communicationColor" as color,
        count(*)::int as total
      from cc_replica."Call" c
      join cc_replica."WmtResponse" w on w.id = c."wmtResponse_id"
      where c."createdOn" >= $1::timestamp
        and c."createdOn" <  $2::timestamp
        and ($3::uuid is null or c.channel_id = $3::uuid)
        and ($4::uuid is null or c.queue_id = $4::uuid)
        and ($5::text is null
             or c."requestNum" ilike '%' || $5 || '%'
             or w.transcription ilike '%' || $5 || '%')
      group by w."communicationColor"
      order by total desc
    `;

    const params = [from, to, channel, queue, q];

    const { rows } = await query<Row>(sql, params);

    const items = rows.map((r) => ({
      nameRu: COLOR_MAP[r.color ?? ""] ?? (r.color ?? "Не определено"),
      value: r.total,
    }));

    const total = items.reduce((s, x) => s + x.value, 0);

    return NextResponse.json(debug ? { items, total, debug: { sql, params } } : { items, total });
  } catch (error) {
    console.error("sentiment v2 error", error);

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
