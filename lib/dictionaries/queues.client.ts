export type QueueDictionaryItemV2 = {
  id?: string | number;
  code?: string;
  queueCode?: string;
  nameRu?: string;
  name?: string;
  label?: string;
  value?: string;
};

export type QueuesDictionaryResponseV2 = {
  items?: QueueDictionaryItemV2[];
};

export async function fetchQueuesV2(): Promise<QueuesDictionaryResponseV2> {
  const res = await fetch("/api/dictionaries/queues/v2", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`queues/v2 failed: ${res.status}`);
  return res.json();
}
