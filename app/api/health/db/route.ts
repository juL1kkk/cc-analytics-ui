import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await query("SELECT 1 as ok");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to run db health check", error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
