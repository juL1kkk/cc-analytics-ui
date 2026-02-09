export type AnalyticsOperatorsParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type OperatorItem = {
  operatorId: number;
  operatorNameRu: string;
  handled: number;
  missed: number;
  ahtSec: number | null;
  fcrPct: number | null;
};

export type OperatorTrendPoint = {
  t: string;
  ahtSec: number | null;
  asaSec: number | null;
};

export type OperatorsResponse = {
  items: OperatorItem[];
  trend: OperatorTrendPoint[];
};

export async function getOperators(
  _params: AnalyticsOperatorsParams,
): Promise<OperatorsResponse> {
  return {
    items: [],
    trend: [],
  };
}
