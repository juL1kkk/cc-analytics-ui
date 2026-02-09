export type AnalyticsQueuesParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
};

export type QueueItem = {
  queueCode: string;
  queueNameRu: string;
  total: number;
  abandonedPct: number | null;
  waiting: number | null;
  avgWaitSec: number | null;
  slaPct: number | null;
};

export type QueueDepthTrendPoint = {
  t: string;
  general?: number | null;
  vip?: number | null;
  antifraud?: number | null;
};

export type QueuesResponse = {
  items: QueueItem[];
  queueDepthTrend: QueueDepthTrendPoint[] | null;
};

export async function getQueues(
  _params: AnalyticsQueuesParams,
): Promise<QueuesResponse> {
  return {
    items: [],
    queueDepthTrend: null,
  };
}
