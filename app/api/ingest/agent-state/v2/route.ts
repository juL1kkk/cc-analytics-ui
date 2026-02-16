import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const ALLOWED_STATES = ["AVAILABLE", "BUSY", "NOT_READY", "OFFLINE"] as const;
type AllowedState = (typeof ALLOWED_STATES)[number];

type AgentStateEventIngestItem = {
  ts: string;
  agentLogin: string;
  userId?: string | null;
  queueCode?: string | null;
  state: string;
  source?: string | null;
  raw?: unknown;
};

function isAllowedState(state: string): state is AllowedState {
  return ALLOWED_STATES.includes(state as AllowedState);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const items: AgentStateEventIngestItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "items[] is required" } },
        { status: 400 },
      );
    }

    const tsValues: string[] = [];
    const agentLoginValues: string[] = [];
    const userIdValues: Array<string | null> = [];
    const queueCodeValues: Array<string | null> = [];
    const stateValues: AllowedState[] = [];
    const sourceValues: Array<string | null> = [];
    const rawValues: Array<string | null> = [];

    for (const item of items) {
      if (!item?.ts || !item?.agentLogin || !item?.state) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Each item requires ts, agentLogin, state" } },
          { status: 400 },
        );
      }

      if (!isAllowedState(item.state)) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: `Invalid state: ${item.state}. Allowed: ${ALLOWED_STATES.join("|")}`,
            },
          },
          { status: 400 },
        );
      }

      tsValues.push(item.ts);
      agentLoginValues.push(item.agentLogin);
      userIdValues.push(item.userId ?? null);
      queueCodeValues.push(item.queueCode ?? null);
      stateValues.push(item.state);
      sourceValues.push(item.source ?? null);
      rawValues.push(item.raw === undefined ? null : JSON.stringify(item.raw));
    }

    await query(
      `
      insert into cc_replica."AgentStateEvent" (
        ts,
        agent_login,
        user_id,
        queue_code,
        state,
        source,
        raw
      )
      select
        t.ts,
        t.agent_login,
        t.user_id,
        t.queue_code,
        t.state,
        t.source,
        t.raw
      from unnest(
        $1::timestamptz[],
        $2::text[],
        $3::uuid[],
        $4::text[],
        $5::text[],
        $6::text[],
        $7::jsonb[]
      ) as t(
        ts,
        agent_login,
        user_id,
        queue_code,
        state,
        source,
        raw
      )
      `,
      [
        tsValues,
        agentLoginValues,
        userIdValues,
        queueCodeValues,
        stateValues,
        sourceValues,
        rawValues,
      ],
    );

    return NextResponse.json({ inserted: items.length });
  } catch (error) {
    console.error("ingest agent state v2 error", error);

    return NextResponse.json(
      {
        error: {
          code: "DB_ERROR",
          message: "Database error",
        },
      },
      { status: 500 },
    );
  }
}
