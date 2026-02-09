import type {
  AnalyticsTopicsTimeSeriesParams,
  TopicTimeSeriesResponse,
} from "./real";

export async function getTopicTimeSeries(
  params: AnalyticsTopicsTimeSeriesParams,
): Promise<TopicTimeSeriesResponse> {
  return {
    topic: params.topicFilter,
    items: [],
  };
}
