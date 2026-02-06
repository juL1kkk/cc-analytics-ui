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
      "SELECT id, channel_code, channel_name_ru FROM public.channels ORDER BY channel_name_ru",
    );

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error("Failed to load channels dictionary", error);

    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
