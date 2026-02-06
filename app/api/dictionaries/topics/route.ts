import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export const runtime = "nodejs";

type TopicRow = {
  id: number;
  topic_code: string;
  topic_name_ru: string;
};

export async function GET() {
  try {
    const { rows } = await query<TopicRow>(
      "SELECT id, topic_code, topic_name_ru FROM public.topics ORDER BY topic_name_ru",
    );

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error("Failed to load topics dictionary", error);

    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
