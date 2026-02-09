import type {
  AnalyticsOperatorsParams,
  OperatorsResponse,
} from "./real";

export async function getOperators(
  _params: AnalyticsOperatorsParams,
): Promise<OperatorsResponse> {
  return {
    items: [],
    trend: [],
  };
}
