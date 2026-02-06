import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "Not implemented yet" }, { status: 501 });
}
