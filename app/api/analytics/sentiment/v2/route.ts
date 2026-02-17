import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveV2PeriodRange } from "@/lib/periodRange";

export const runtime = "nodejs";

type Row = { color: string | null; total: number };

const COLOR_MAP: Record<string, string> = {
  red: "Негатив",
  yellow: "Нейтрально",
  green: "Позитив",
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
