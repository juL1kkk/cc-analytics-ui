export type AgentStateSummaryV2 = {
  onLine: number;
  waiting: number;
  unavailable: number;
  total: number;
};

function toQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

export type FetchAgentStateSummaryV2Params = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  queue?: string;
  debug?: string | boolean;
};

export async function fetchAgentStateSummaryV2(
  filters: FetchAgentStateSummaryV2Params,
): Promise<AgentStateSummaryV2> {
  const q = toQuery(filters);
  const res = await fetch(`/api/analytics/agent-state/summary/v2${q ? `?${q}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`agent-state/summary/v2 failed: ${res.status}`);
  }

  return res.json();
}
