import type {
  AnalyticsTimeSeriesParams,
  TimeSeriesResponse,
} from "./real";

export async function getTimeSeries(
  params: AnalyticsTimeSeriesParams,
): Promise<TimeSeriesResponse> {
  const granularity = params.granularity === "day" ? "day" : "hour";

  return {
    granularity,
    items: [],
  };
}
