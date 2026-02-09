import { getAnalyticsDataSource } from "@/lib/analytics/provider";
import { getTopicsTop as getTopicsTopMock } from "@/lib/analytics/topics/top/mock";
import { getTopicsTop as getTopicsTopReal } from "@/lib/analytics/topics/top/real";
import { NextResponse } from "next/server";

const parseNumber = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = {
    period: searchParams.get("period") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    dept: searchParams.get("dept") ?? undefined,
    channel: searchParams.get("channel") ?? undefined,
    queue: searchParams.get("queue") ?? undefined,
    topic: searchParams.get("topic") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    limit: parseNumber(searchParams.get("limit")),
  };

  try {
    const dataSource = getAnalyticsDataSource();
    const data =
      dataSource === "MOCK"
        ? await getTopicsTopMock(params)
        : await getTopicsTopReal(params);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics:topics:top]", error);
    return NextResponse.json(
      { message: "ANALYTICS_TOPICS_TOP_ERROR" },
      { status: 500 },
    );
  }
}
