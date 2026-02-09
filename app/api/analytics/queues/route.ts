import { getAnalyticsDataSource } from "@/lib/analytics/provider";
import { getQueues as getQueuesMock } from "@/lib/analytics/queues/mock";
import { getQueues as getQueuesReal } from "@/lib/analytics/queues/real";
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
        ? await getQueuesMock(params)
        : await getQueuesReal(params);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics:queues]", error);
    return NextResponse.json(
      { message: "ANALYTICS_QUEUES_ERROR" },
      { status: 500 },
    );
  }
}
