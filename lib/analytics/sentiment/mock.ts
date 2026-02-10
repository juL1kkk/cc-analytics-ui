import type { AnalyticsSentimentParams, SentimentResponse } from "./real";

export async function getSentiment(
  params: AnalyticsSentimentParams,
): Promise<SentimentResponse> {
  void params;

  const items = [
    { nameRu: "Негатив", value: 10 },
    { nameRu: "Нейтрально", value: 30 },
    { nameRu: "Позитив", value: 60 },
  ];

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return { items, total };
}
