import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export const runtime = "nodejs";

type ChannelRow = {
  id: number;
  code: string;
  name_ru: string;
};

export async function GET() {
  try {
    const { rows } = await query<ChannelRow>(
      "SELECT id, channel_code AS code, name_ru FROM public.channels WHERE is_active = true ORDER BY name_ru",
    );

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        nameRu: row.name_ru,
      })),
    });
  } catch (error) {
    console.error("Failed to load channels dictionary", error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
