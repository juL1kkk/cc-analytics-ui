import type { AnalyticsQueuesParams, QueuesResponse } from "./real";

export async function getQueues(
  _params: AnalyticsQueuesParams,
): Promise<QueuesResponse> {
  return {
    items: [],
    queueDepthTrend: [],
  };
}
