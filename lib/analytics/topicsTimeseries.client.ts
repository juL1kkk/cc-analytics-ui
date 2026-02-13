export type TopicsTimeseriesPointV2 = {
  t: string;
  incoming: number;
  missed: number;
};

export type TopicsTimeseriesResponseV2 = {
  topic: string;
  items: TopicsTimeseriesPointV2[];
};

export type TopicsTimeseriesParamsV2 = {
  period?: "today" | "yesterday" | "7d" | "30d" | "custom";
  from?: string;
  to?: string;
  bucket?: "hour" | "day";
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  operator?: string;
  q?: string;
};

function toQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

export async function fetchTopicsTimeseriesV2(
  params: TopicsTimeseriesParamsV2
): Promise<TopicsTimeseriesResponseV2> {
  const q = toQuery(params);
  const res = await fetch(
    `/api/analytics/topics/timeseries/v2${q ? `?${q}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`topics/timeseries/v2 failed: ${res.status}`);
  }

  return res.json();
}
