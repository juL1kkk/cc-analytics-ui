import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type ChannelRow = {
  id: string;          // uuid
  code: string;
  name: string | null;
  active: boolean | null;
};

export async function GET(request: Request) {
  try {
    const { rows } = await query<ChannelRow>(
      `
      SELECT
        id,
        code,
        name,
        active
      FROM cc_replica."Channel"
      WHERE COALESCE(active, true) = true
      ORDER BY code ASC
      `,
    );

    const items = rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameRu: row.name ?? row.code,
      active: row.active ?? true,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("channels error", error);

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
