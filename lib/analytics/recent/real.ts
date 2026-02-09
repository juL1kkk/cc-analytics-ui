export type AnalyticsRecentParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type RecentItem = {
  externalId: string;
  startedAt: string;
  channelCode: string;
  channelNameRu: string;
  queueCode: string;
  queueNameRu: string;
  departmentNameRu: string;
  operatorNameRu: string | null;
  topicNameRu: string | null;
  durationSec: number;
  statusCode: "completed" | "missed" | "waiting" | "in_progress";
  statusRu: "Завершён" | "Пропущен" | "Ожидание" | "В разговоре";
};

export type RecentResponse = {
  items: RecentItem[];
  total: number;
};

export async function getRecent(
  _params: AnalyticsRecentParams,
): Promise<RecentResponse> {
  return {
    items: [],
    total: 0,
  };
}
