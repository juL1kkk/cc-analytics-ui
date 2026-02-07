import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type OperatorRow = {
  id: number;
  full_name: string;
  is_active?: boolean;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    // По умолчанию показываем только активных.
    // Если нужно всех — дерни ?all=1
    const includeInactive =
      url.searchParams.get("all") === "1" || url.searchParams.get("all") === "true";

    const sql = includeInactive
      ? `
        SELECT id, full_name, is_active
        FROM public.operators
        ORDER BY full_name ASC
      `
      : `
        SELECT id, full_name, is_active
        FROM public.operators
        WHERE is_active = true
        ORDER BY full_name ASC
      `;

    const { rows } = await query<OperatorRow>(sql);

    // В UI/Swagger ожидаются поля code и nameRu
    const items = rows.map((row) => ({
      id: row.id,
      code: row.full_name,
      nameRu: row.full_name,
      // опционально, чтобы было удобно дебажить:
      // isActive: row.is_active ?? null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("operators error", error);
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