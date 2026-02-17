import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type TicketSubjectOutRow = {
  id: string;
  code?: string;
  name: string;
  active?: boolean;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";
    const debug = url.searchParams.get("debug") === "1";

    const sql = `
      SELECT "id", "code", "name"${debug ? `, "active"` : ""}
      FROM cc_replica."TicketSubject"
      ${!all && debug ? `WHERE "active" = true` : ""}
      ORDER BY "name" ASC
    `;

    const { rows } = await query<TicketSubjectOutRow>(sql);

    const items = rows.map((row) => ({
      id: String(row.id),
      ...(row.code ? { code: String(row.code) } : {}),
      nameRu: row.name,
      ...(debug && row.active !== undefined ? { active: row.active } : {}),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("TicketSubjectOut dictionary error", error);

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
