import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type QueueRow = {
  id: string; // uuid
  code: string;
  name: string | null;
  description: string | null;
  active: boolean | null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wantDetails = url.searchParams.get("debug") === "1";

    const { rows } = await query<QueueRow>(
      `
      SELECT
        id,
        code,
        name,
        description,
        active
      FROM cc_replica."Queues"
      WHERE COALESCE(active, true) = true
      ORDER BY COALESCE(name, code) ASC
      `,
    );

    const items = rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameRu: row.name ?? row.code,
      description: row.description ?? null,
      active: row.active ?? true,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("queues v2 error", error);

    const url = new URL(request.url);
    const wantDetails = url.searchParams.get("debug") === "1";

    const details =
      wantDetails && error instanceof Error
        ? error.message
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
