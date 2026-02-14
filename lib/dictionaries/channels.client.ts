export type ChannelDictionaryItemV2 = {
  id?: string | number;
  code?: string;
  channelCode?: string;
  nameRu?: string;
  name?: string;
  label?: string;
  value?: string;
};

export type ChannelsDictionaryResponseV2 = {
  items?: ChannelDictionaryItemV2[];
};

export async function fetchChannelsV2(): Promise<ChannelsDictionaryResponseV2> {
  const res = await fetch("/api/dictionaries/channels/v2", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`channels/v2 failed: ${res.status}`);
  return res.json();
}
