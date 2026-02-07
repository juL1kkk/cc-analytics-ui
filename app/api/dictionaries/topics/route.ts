import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type TopicRow = {
  id: number;
  name: string;
  active: boolean;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";
    const debug = url.searchParams.get("debug") === "1";

    const sql = `
      SELECT id, name, active
      FROM public.topics
      ${all ? "" : "WHERE active = true"}
      ORDER BY active DESC, id ASC
    `;

    const { rows } = await query<TopicRow>(sql);

    const items = rows.map((row) => ({
      id: String(row.id),
      code: String(row.id),   // т.к. в БД нет code — используем id
      nameRu: row.name,
      ...(debug ? { active: row.active } : {}),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("topics error", error);

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