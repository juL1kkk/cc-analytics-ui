import type { AnalyticsTopicsTopParams, TopicsTopResponse } from "./real";

export async function getTopicsTop(
  _params: AnalyticsTopicsTopParams,
): Promise<TopicsTopResponse> {
  return {
    topTopics: [],
    channelSplit: [],
    sentimentSplit: null,
    goalSplit: null,
  };
}
