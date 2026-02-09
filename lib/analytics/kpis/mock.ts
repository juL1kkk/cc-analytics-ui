import type { AnalyticsKpisParams, KpisResponse } from "./real";

export async function getKpis(_params: AnalyticsKpisParams): Promise<KpisResponse> {
  return {
    incoming: 0,
    missed: 0,
    ahtSec: null,
    operatorsOnCalls: 0,
    operatorsTotal: 0,
    fcrPct: 0,
    avgWaitSec: null,
    slaPct: null,
  };
}
