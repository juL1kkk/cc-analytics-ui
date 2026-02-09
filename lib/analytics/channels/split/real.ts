export type AnalyticsChannelsSplitParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
};

export type ChannelsSplitItem = {
  channelCode: string;
  channelNameRu: string;
  incoming: number;
  outgoing: number | null;
  responseSec: number | null;
};

export type ChannelResponseTrendPoint = {
  t: string;
  voice?: number | null;
  chat?: number | null;
  email?: number | null;
  sms?: number | null;
  push?: number | null;
};

export type ChannelsSplitResponse = {
  split: ChannelsSplitItem[];
  responseTrend: ChannelResponseTrendPoint[];
};

export async function getChannelsSplit(
  _params: AnalyticsChannelsSplitParams,
): Promise<ChannelsSplitResponse> {
  return {
    split: [],
    responseTrend: [],
  };
}
