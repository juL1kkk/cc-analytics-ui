import { getChannelsSplit as getChannelsSplitMock } from "@/lib/analytics/channels/split/mock";
import { getChannelsSplit as getChannelsSplitReal } from "@/lib/analytics/channels/split/real";
import { getAnalyticsDataSource } from "@/lib/analytics/provider";
import { NextResponse } from "next/server";

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
  };

  try {
    const dataSource = getAnalyticsDataSource();
    const data =
      dataSource === "MOCK"
        ? await getChannelsSplitMock(params)
        : await getChannelsSplitReal(params);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics:channels:split]", error);
    return NextResponse.json(
      { message: "ANALYTICS_CHANNELS_SPLIT_ERROR" },
      { status: 500 },
    );
  }
}
