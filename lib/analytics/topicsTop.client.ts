export type TopicTopItemV2 = {
  topicId: number;
  topicNameRu: string;
  count: number;
  avgHandleSec: number;
  fcrPct: number;
};

export type TopicsTopResponseV2 = {
  topTopics: TopicTopItemV2[];
  channelSplit: Array<{ nameRu: string; value: number }> | null;
  sentimentSplit: Array<{ nameRu: string; value: number }> | null;
  goalSplit: Array<{ nameRu: string; value: number }> | null;
};

function toQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

export async function fetchTopicsTopV2(
  filters: Record<string, unknown>
): Promise<TopicsTopResponseV2> {
  const q = toQuery(filters);
  const res = await fetch(`/api/analytics/topics/top/v2${q ? `?${q}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`topics/top/v2 failed: ${res.status}`);
  return res.json();
}
