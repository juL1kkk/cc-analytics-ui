import { getTimeSeries as getTimeSeriesMock } from "@/lib/analytics/timeseries/mock";
import { getTimeSeries as getTimeSeriesReal } from "@/lib/analytics/timeseries/real";
import { getAnalyticsDataSource } from "@/lib/analytics/provider";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const granularityParam = searchParams.get("granularity");
  const granularity =
    granularityParam === "auto" ||
    granularityParam === "hour" ||
    granularityParam === "day"
      ? granularityParam
      : undefined;

  const params = {
    period: searchParams.get("period") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    dept: searchParams.get("dept") ?? undefined,
    channel: searchParams.get("channel") ?? undefined,
    queue: searchParams.get("queue") ?? undefined,
    topic: searchParams.get("topic") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    granularity,
  };

  try {
    const dataSource = getAnalyticsDataSource();
    const data =
      dataSource === "MOCK"
        ? await getTimeSeriesMock(params)
        : await getTimeSeriesReal(params);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics:timeseries]", error);
    return NextResponse.json(
      { message: "ANALYTICS_TIMESERIES_ERROR" },
      { status: 500 },
    );
  }
}
