export type AnalyticsTopicsTimeSeriesParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  topicFilter: string;
};

export type TopicTimeSeriesPoint = {
  t: string;
  incoming: number;
  missed: number;
};

export type TopicTimeSeriesResponse = {
  topic: string;
  items: TopicTimeSeriesPoint[];
};

export async function getTopicTimeSeries(
  params: AnalyticsTopicsTimeSeriesParams,
): Promise<TopicTimeSeriesResponse> {
  return {
    topic: params.topicFilter,
    items: [],
  };
}
