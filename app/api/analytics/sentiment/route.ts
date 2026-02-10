import { getAnalyticsDataSource } from "@/lib/analytics/provider";
import { getSentiment as getSentimentMock } from "@/lib/analytics/sentiment/mock";
import { getSentiment as getSentimentReal } from "@/lib/analytics/sentiment/real";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const params = {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    active: searchParams.get("active") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  };

  try {
    const dataSource = getAnalyticsDataSource();
    const data =
      dataSource === "MOCK"
        ? await getSentimentMock(params)
        : await getSentimentReal(params);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics:sentiment]", error);

    const wantDetails = searchParams.get("debug") === "1";
    const details = wantDetails
      ? error instanceof Error
        ? error.message
        : String(error)
      : undefined;

    return NextResponse.json(
      {
        message: "ANALYTICS_SENTIMENT_ERROR",
        ...(details ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
