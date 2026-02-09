import type { AnalyticsRecentParams, RecentResponse } from "./real";

export async function getRecent(
  _params: AnalyticsRecentParams,
): Promise<RecentResponse> {
  return {
    items: [],
    total: 0,
  };
}
