import type {
  AnalyticsChannelsSplitParams,
  ChannelsSplitResponse,
} from "./real";

export async function getChannelsSplit(
  _params: AnalyticsChannelsSplitParams,
): Promise<ChannelsSplitResponse> {
  return {
    split: [],
    responseTrend: [],
  };
}
