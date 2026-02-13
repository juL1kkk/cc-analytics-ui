export type KpisV2Filters = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  operator?: string;
  topic?: string;
  q?: string;
};

export type KpisV2Response = {
  incoming: number;
  missed: number;
  completed: number;
  ahtSec: number;
  total: number;
};

function toQuery(filters: KpisV2Filters) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }

  return qs.toString();
}

export async function fetchKpisV2(filters: KpisV2Filters): Promise<KpisV2Response> {
  const query = toQuery(filters);
  const res = await fetch(`/api/analytics/kpis/v2${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`kpis/v2 failed: ${res.status}`);
  return res.json();
}
