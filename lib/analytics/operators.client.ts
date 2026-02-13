export type OperatorRowV2 = {
  operatorId: number;
  operatorNameRu: string;
  handled: number;
  missed: number;
  ahtSec: number;
  fcrPct: number;
};

export type OperatorsResponseV2 = {
  items: OperatorRowV2[];
  trend: { t: string; ahtSec: number; asaSec: number | null }[];
};

function toQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

export async function fetchOperatorsV2(
  filters: Record<string, unknown>
): Promise<OperatorsResponseV2> {
  const q = toQuery(filters);
  const res = await fetch(`/api/analytics/operators/v2${q ? `?${q}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`operators/v2 failed: ${res.status}`);
  return res.json();
}
