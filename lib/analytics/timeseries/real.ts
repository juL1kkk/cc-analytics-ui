export type AnalyticsTimeSeriesParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  granularity?: "auto" | "hour" | "day";
};

export type TimeSeriesPoint = {
  t: string;
  incoming: number;
  missed: number;
  ahtSec: number | null;
};

export type TimeSeriesResponse = {
  granularity: "hour" | "day";
  items: TimeSeriesPoint[];
};

export async function getTimeSeries(
  params: AnalyticsTimeSeriesParams,
): Promise<TimeSeriesResponse> {
  const granularity = params.granularity === "day" ? "day" : "hour";

  return {
    granularity,
    items: [],
  };
}
