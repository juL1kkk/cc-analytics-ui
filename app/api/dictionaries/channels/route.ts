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
      "select id, channel_code, channel_name_ru from public.channels order by channel_name_ru",
    );
    const items = rows.map((row: ChannelRow) => ({
      id: row.id,
      code: row.channel_code,
      nameRu: row.channel_name_ru,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load channels dictionary", error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
