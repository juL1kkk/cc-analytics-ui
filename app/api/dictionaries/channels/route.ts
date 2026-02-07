import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export const runtime = "nodejs";

type ChannelRow = {
  id: number;
  channel_code: string;
  channel_name_ru: string;
};

export async function GET() {
  try {
    const { rows } = await query<ChannelRow>(
      "SELECT id, channel_code, channel_name_ru FROM public.channels ORDER BY channel_name_ru ASC, channel_code ASC",
    );

    const items = rows.map((row) => ({
      id: row.id,
      code: row.channel_code,
      nameRu: row.channel_name_ru,
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
