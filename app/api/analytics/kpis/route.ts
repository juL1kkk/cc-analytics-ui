import { getKpis as getKpisMock } from "@/lib/analytics/kpis/mock";
import { getKpis as getKpisReal } from "@/lib/analytics/kpis/real";
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
        ? await getKpisMock(params)
        : await getKpisReal(params);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics:kpis]", error);
    return NextResponse.json(
      { message: "ANALYTICS_KPIS_ERROR" },
      { status: 500 },
    );
  }
}
