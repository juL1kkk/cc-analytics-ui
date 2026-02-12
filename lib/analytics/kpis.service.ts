import { getAnalyticsDataSource } from "@/config/analyticsSource";
import type { KpisFilters, KpisResponse } from "./kpis.types";
import { getMockKpis } from "./kpis.mock";
import { getRealKpis } from "./kpis.real";

export async function getKpis(filters: KpisFilters): Promise<KpisResponse> {
  const source = getAnalyticsDataSource();

  if (source === "MOCK") return getMockKpis(filters);

  try {
    return await getRealKpis(filters);
  } catch (e) {
    console.error("[KPIS] REAL_DB failed, fallback to MOCK", e);
    return getMockKpis(filters);
  }
}
