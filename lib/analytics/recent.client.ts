export type RecentV2Filters = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  operator?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type RecentV2Item = {
  externalId: string;
  startedAt: string;
  channelCode: "voice" | "chat" | "email" | "sms" | "push";
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

export type RecentV2Response = {
  items: RecentV2Item[];
  total: number;
};

function toQuery(filters: RecentV2Filters) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }

  return qs.toString();
}

export async function fetchRecentV2(params: RecentV2Filters): Promise<RecentV2Response> {
  const query = toQuery(params);
  const res = await fetch(`/api/analytics/recent/v2${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`recent/v2 failed: ${res.status}`);
  return res.json();
}
