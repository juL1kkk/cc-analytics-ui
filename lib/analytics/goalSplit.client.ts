export type GoalSplitV2Filters = {
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

export type GoalSplitV2Slice = {
  nameRu: string;
  value: number;
};

export type GoalSplitV2Response = {
  goalSplit: GoalSplitV2Slice[] | null;
};

function toQuery(filters: GoalSplitV2Filters) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }

  return qs.toString();
}

export async function fetchGoalSplitV2(
  filters: GoalSplitV2Filters,
): Promise<GoalSplitV2Slice[] | null> {
  const query = toQuery(filters);
  const res = await fetch(`/api/analytics/topics/top/v2${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`goalSplit source failed: ${res.status}`);
  const data = (await res.json()) as GoalSplitV2Response;
  return data.goalSplit ?? null;
}
