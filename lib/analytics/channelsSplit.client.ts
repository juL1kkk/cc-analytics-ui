export type ChannelsSplitV2Filters = {
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

export type ChannelsSplitV2Item = {
  channel: string;
  incoming: number;
  outgoing: number;
};

export type ChannelsSplitV2Response = {
  items: ChannelsSplitV2Item[];
};

function toQuery(filters: ChannelsSplitV2Filters) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }

  return qs.toString();
}

export async function fetchChannelsSplitV2(
  filters: ChannelsSplitV2Filters
): Promise<ChannelsSplitV2Response> {
  const query = toQuery(filters);
  const res = await fetch(`/api/analytics/channels/split/v2${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`channels/split/v2 failed: ${res.status}`);

  const data = await res.json();
  const split = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.split)
    ? data.split
    : [];

  return {
    items: split.map((item: any) => ({
      channel: String(item?.channel ?? item?.channelCode ?? ""),
      incoming: Number(item?.incoming ?? 0),
      outgoing: Number(item?.outgoing ?? 0),
    })),
  };
}
