import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type ChannelRow = {
  id: number;
  name: string;
};

export async function GET() {
  try {
    const { rows } = await query<ChannelRow>(
      "SELECT id, name FROM public.channels ORDER BY name ASC",
    );

    // В UI/Swagger сейчас ожидаются поля code и nameRu.
    // В текущей БД есть только name, поэтому временно маппим name -> code/nameRu
    const items = rows.map((row) => ({
      id: row.id,
      code: row.name,
      nameRu: row.name,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("channels error", error);
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
