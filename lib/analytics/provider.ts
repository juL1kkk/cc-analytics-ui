export type AnalyticsDataSource = "REAL_DB" | "MOCK";

const DEFAULT_SOURCE: AnalyticsDataSource = "MOCK";

export function getAnalyticsDataSource(): AnalyticsDataSource {
  const envSource = process.env.ANALYTICS_DATA_SOURCE;

  if (envSource === "MOCK" || envSource === "REAL_DB") {
    return envSource;
  }

  return DEFAULT_SOURCE;
}
