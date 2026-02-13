export type ChannelsSplitRowV2 = {
  channelCode: string;
  channelNameRu: string;
  incoming: number;
  outgoing: number;
  responseSec: number | null;
};

export type ChannelsSplitResponseV2 = {
  split: ChannelsSplitRowV2[];
  responseTrend: any[];
};

function toQuery(params: Record<string, any>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

export async function fetchChannelsSplitV2(
  filters: Record<string, any>
): Promise<ChannelsSplitResponseV2> {
  const q = toQuery(filters);
  const res = await fetch(`/api/analytics/channels/split/v2${q ? `?${q}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`channels/split/v2 failed: ${res.status}`);
  return res.json();
}
