import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveV2PeriodRange } from "@/lib/periodRange";
import { isUuid } from "@/lib/isUuid";

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

    const channel = url.searchParams.get("channel")?.trim() || null;
    const queue = url.searchParams.get("queue")?.trim() || null;
    const q = url.searchParams.get("q")?.trim() || null;

    const channelIsUuid = isUuid(channel);
    const queueIsUuid = isUuid(queue);

    const params: Array<string | Date | null> = [from, to];
    const whereClauses: string[] = [
      `c."createdOn" >= $1::timestamp`,
      `c."createdOn" <  $2::timestamp`,
    ];
    const joins: string[] = [
      `join cc_replica."WmtResponse" w on w.id = c."wmtResponse_id"`,
    ];

    if (channel) {
      if (channelIsUuid) {
        params.push(channel);
        whereClauses.push(`c.channel_id = $${params.length}::uuid`);
      } else {
        params.push(channel);
        joins.push(
          `join cc_replica."Channel" ch on ch.id = c.channel_id and ch.code = $${params.length}::text`,
        );
      }
    }

    if (queue) {
      if (queueIsUuid) {
        params.push(queue);
        whereClauses.push(`c.queue_id = $${params.length}::uuid`);
      } else {
        params.push(queue);
        joins.push(
          `join cc_replica."Queues" qu on qu.id = c.queue_id and qu.code = $${params.length}::text`,
        );
      }
    }

    if (q) {
      params.push(q);
      whereClauses.push(
        `(c."requestNum" ilike '%' || $${params.length} || '%' or w.transcription ilike '%' || $${params.length} || '%')`,
      );
    }

    const sql = `
      select
        w."communicationColor" as color,
        count(*)::int as total
      from cc_replica."Call" c
      ${joins.join("\n      ")}
      where ${whereClauses.join("\n        and ")}
      group by w."communicationColor"
      order by total desc
    `;

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
