import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type DepartmentRow = {
  id: string; // uuid
  code: string;
  name: string | null;
};

export async function GET() {
  try {
    const { rows } = await query<DepartmentRow>(
      `
      SELECT
        id,
        code,
        name
      FROM cc_replica."Department"
      WHERE COALESCE(active, true) = true
      ORDER BY name ASC
      `,
    );

    // UI / Swagger ожидают единый формат:
    // { id, code, nameRu }
    const items = rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameRu: row.name ?? row.code,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("departments error", error);

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
