export type TimeseriesPointV2 = {
  t: string;          // "2026-02-13T10:00:00Z" или "10:00" — как отдаёт API
  incoming: number;
  missed: number;
  ahtSec?: number;    // если API отдаёт
};

export type TimeseriesResponseV2 = {
  items: TimeseriesPointV2[];
};

function toQuery(params: Record<string, any>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

export async function fetchTimeseriesV2(filters: Record<string, any>): Promise<TimeseriesResponseV2> {
  const q = toQuery(filters);
  const res = await fetch(`/api/analytics/timeseries/v2${q ? `?${q}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`timeseries/v2 failed: ${res.status}`);
  return res.json();
}
