import { NextResponse } from "next/server";

import { dbHealthcheck } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const hasDatabaseUrl = Boolean(
    process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED,
  );
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
  const now = new Date().toISOString();
  const db = await dbHealthcheck();

  return NextResponse.json({
    ok: db.ok,
    hasDatabaseUrl,
    env,
    now,
    db,
  });
}
