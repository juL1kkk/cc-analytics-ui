export type TopicDictionaryItemV2 = {
  id: string;
  nameRu: string;
};

export type TopicsDictionaryResponseV2 = {
  items: TopicDictionaryItemV2[];
};

async function fetchTopicDictionary(endpoint: string): Promise<TopicsDictionaryResponseV2> {
  const res = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`${endpoint} failed: ${res.status}`);
  const data = (await res.json()) as TopicsDictionaryResponseV2;
  return {
    items: (data.items ?? []).filter((item): item is TopicDictionaryItemV2 => {
      return Boolean(item?.id && item?.nameRu);
    }),
  };
}

export async function fetchTopicsV2(
  direction: "all" | "in" | "out"
): Promise<TopicsDictionaryResponseV2> {
  if (direction === "in") {
    return fetchTopicDictionary("/api/dictionaries/TicketSubject");
  }

  if (direction === "out") {
    return fetchTopicDictionary("/api/dictionaries/TicketSubjectOut");
  }

  const [incoming, outgoing] = await Promise.all([
    fetchTopicDictionary("/api/dictionaries/TicketSubject"),
    fetchTopicDictionary("/api/dictionaries/TicketSubjectOut"),
  ]);

  const merged = new Map<string, TopicDictionaryItemV2>();
  for (const item of [...incoming.items, ...outgoing.items]) {
    if (!merged.has(item.id)) {
      merged.set(item.id, item);
    }
  }

  return { items: Array.from(merged.values()) };
}
