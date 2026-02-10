import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type UserRow = {
  id: string; // uuid
  name: string | null;
  login: string;
  active: boolean | null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    // По умолчанию показываем только активных.
    // Если нужно всех — ?all=1|true
    const includeInactive =
      url.searchParams.get("all") === "1" || url.searchParams.get("all") === "true";

    const sql = includeInactive
      ? `
        SELECT id, "name", login, active
        FROM cc_replica."User"
        ORDER BY COALESCE(NULLIF(TRIM("name"), ''), login) ASC
      `
      : `
        SELECT id, "name", login, active
        FROM cc_replica."User"
        WHERE active = true
        ORDER BY COALESCE(NULLIF(TRIM("name"), ''), login) ASC
      `;

    const { rows } = await query<UserRow>(sql);

    const items = rows.map((row) => {
      const display = row.name && row.name.trim() ? row.name.trim() : row.login;

      return {
        id: row.id,      // uuid string
        code: display,   // как раньше full_name
        nameRu: display, // как раньше full_name
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("users error", error);
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
