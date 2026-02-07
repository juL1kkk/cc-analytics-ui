import { Client } from "pg";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  let client: Client | null = null;
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_URL is not set" },
        { status: 500 },
      );
    }

    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query("SELECT 1");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to load channels dictionary", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}
