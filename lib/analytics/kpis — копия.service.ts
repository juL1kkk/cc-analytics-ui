import type { KpisFilters, KpisResponse } from "@/lib/analytics/kpis.types";

function toQuery(filters: Record<string, any>) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

export async function fetchKpisV2(filters: KpisFilters): Promise<KpisResponse> {
  const q = toQuery(filters as any);
  const res = await fetch(`/api/analytics/kpis/v2${q ? `?${q}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`kpis/v2 failed: ${res.status}`);
  return res.json();
}
