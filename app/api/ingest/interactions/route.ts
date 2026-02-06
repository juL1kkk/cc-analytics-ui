import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Not implemented yet" } },
    { status: 501 },
  );
}
