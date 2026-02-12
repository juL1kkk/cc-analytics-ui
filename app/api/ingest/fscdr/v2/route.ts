import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type FsCdrItem = {
  id: string;
  direction: "inbound" | "outbound" | string;
  caller?: string | null;
  callee?: string | null;
  start_stamp?: string | null;
  answer_stamp?: string | null;
  end_stamp?: string | null;
  duration_sec?: number | null;
  billsec?: number | null;
  hangup_cause?: string | null;
  sip_status?: string | null;
  queue_code?: string | null;
  agent_login?: string | null;
  raw?: any;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const items: FsCdrItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "items[] is required" } },
        { status: 400 },
      );
    }

    // Вставляем поштучно (MVP). Оптимизируем батчем позже.
    let upserted = 0;

    for (const it of items) {
      if (!it?.id || !it?.direction) continue;

      await query(
        `
        insert into cc_replica."FsCdr" (
          id, direction, caller, callee,
          start_stamp, answer_stamp, end_stamp,
          duration_sec, billsec,
          hangup_cause, sip_status,
          queue_code, agent_login,
          raw
        ) values (
          $1::uuid, $2, $3, $4,
          $5::timestamptz, $6::timestamptz, $7::timestamptz,
          $8::int, $9::int,
          $10, $11,
          $12, $13,
          $14::jsonb
        )
        on conflict (id) do update set
          direction = excluded.direction,
          caller = excluded.caller,
          callee = excluded.callee,
          start_stamp = excluded.start_stamp,
          answer_stamp = excluded.answer_stamp,
          end_stamp = excluded.end_stamp,
          duration_sec = excluded.duration_sec,
          billsec = excluded.billsec,
          hangup_cause = excluded.hangup_cause,
          sip_status = excluded.sip_status,
          queue_code = excluded.queue_code,
          agent_login = excluded.agent_login,
          raw = excluded.raw
        `,
        [
          it.id,
          it.direction,
          it.caller ?? null,
          it.callee ?? null,
          it.start_stamp ?? null,
          it.answer_stamp ?? null,
          it.end_stamp ?? null,
          it.duration_sec ?? null,
          it.billsec ?? null,
          it.hangup_cause ?? null,
          it.sip_status ?? null,
          it.queue_code ?? null,
          it.agent_login ?? null,
          it.raw ? JSON.stringify(it.raw) : null,
        ],
      );

      upserted += 1;
    }

    return NextResponse.json({ ok: true, upserted });
  } catch (error) {
    console.error("ingest fscdr v2 error", error);

    const details =
      process.env.NODE_ENV !== "production"
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
