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

    // ЖЕЛЕЗНАЯ ПРОВЕРКА: видно в логах какой режим реально выбран
    console.log("[analytics:kpis] dataSource =", dataSource);

    const data =
      dataSource === "MOCK" ? await getKpisMock(params) : await getKpisReal(params);

    // ЖЕЛЕЗНАЯ ПРОВЕРКА: видно снаружи (curl -i) какой режим отработал
    const res = NextResponse.json(data, { status: 200 });
    res.headers.set("x-analytics-data-source", dataSource);
    return res;
  } catch (error) {
    console.error("[analytics:kpis]", error);
    return NextResponse.json(
      { message: "ANALYTICS_KPIS_ERROR" },
      { status: 500 },
    );
  }
}
