export type AnalyticsKpisParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
};

export type KpisResponse = {
  incoming: number;
  missed: number;
  ahtSec: number | null;
  operatorsOnCalls: number;
  operatorsTotal: number;
  fcrPct: number;
  avgWaitSec: number | null;
  slaPct: number | null;
};

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
