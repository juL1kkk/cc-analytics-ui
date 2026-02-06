import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented yet" } },
    { status: 501 },
  );
}
