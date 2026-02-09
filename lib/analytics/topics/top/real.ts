export type AnalyticsTopicsTopParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  limit?: number;
};

export type TopicTopItem = {
  topicId: number;
  topicNameRu: string;
  count: number;
  avgHandleSec: number | null;
  fcrPct: number | null;
};

export type DonutSlice = {
  nameRu: string;
  value: number;
};

export type TopicsTopResponse = {
  topTopics: TopicTopItem[];
  channelSplit: DonutSlice[];
  sentimentSplit: DonutSlice[] | null;
  goalSplit: DonutSlice[] | null;
};

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
