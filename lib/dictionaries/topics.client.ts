export type TopicDictionaryItemV2 = {
  id?: string | number;
  code?: string;
  topicCode?: string;
  nameRu?: string;
  name?: string;
  label?: string;
  value?: string;
};

export type TopicsDictionaryResponseV2 = {
  items?: TopicDictionaryItemV2[];
};

export async function fetchTopicsV2(): Promise<TopicsDictionaryResponseV2> {
  const res = await fetch("/api/dictionaries/TicketSubjectOut", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`TicketSubjectOut failed: ${res.status}`);
  return res.json();
}
