export type SentimentV2Params = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  operator?: string;
  q?: string;
};

export type SentimentV2Response = {
  items: Array<{ nameRu: string; value: number }>;
  total: number;
};

function toQuery(params: SentimentV2Params) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }

  return qs.toString();
}

export async function fetchSentimentV2(
  params: SentimentV2Params,
): Promise<SentimentV2Response> {
  const query = toQuery(params);
  const res = await fetch(`/api/analytics/sentiment/v2${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`sentiment/v2 failed: ${res.status}`);
  return res.json();
}
