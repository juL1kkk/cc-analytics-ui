import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export const runtime = "nodejs";

type ChannelRow = {
  id: number;
  name: string;
};

export async function GET(request: Request) {
  try {
    // В текущей БД таблица public.channels имеет поля: id, name
    const { rows } = await query<ChannelRow>(
      'SELECT id, "name" FROM public.channels ORDER BY "name" ASC',
    );

    // UI/Swagger ожидают поля code и nameRu.
    // В текущей БД есть только name, поэтому временно маппим name -> code/nameRu
    const items = rows.map((row) => ({
      id: row.id,
      code: row.name,
      nameRu: row.name,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("channels error", error);

    // Позволяет получить details даже в production, но только если явно передать debug=1
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
