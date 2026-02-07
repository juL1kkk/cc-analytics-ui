import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type QueueRow = {
  id: number;
  name: string;
  description: string | null;
};

export async function GET() {
  try {
    const { rows } = await query<QueueRow>(
      `
      SELECT id, name, description
      FROM public.queues
      ORDER BY name ASC
      `.trim(),
    );

    const items = rows.map((row) => ({
      id: String(row.id),
      code: row.name,        // временно: пока в БД нет отдельного code
      nameRu: row.name,      // временно: name -> nameRu
      description: row.description ?? null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("queues error", error);

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