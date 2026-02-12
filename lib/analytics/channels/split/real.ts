import { query } from "@/lib/db";

export type AnalyticsChannelsSplitParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;    // uuid
  channel?: string; // uuid
  queue?: string;   // uuid
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

function parseDateOrNull(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function periodToRange(period?: string): { from: Date; to: Date } | null {
  if (!period) return null;
  const now = new Date();
  const to = now;
  const from = new Date(now);

  if (period === "today") from.setHours(0, 0, 0, 0);
  else if (period === "yesterday") {
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
  } else if (period === "7d") from.setDate(from.getDate() - 7);
  else if (period === "30d") from.setDate(from.getDate() - 30);
  else return null;

  return { from, to };
}

export async function getChannelsSplit(
  params: AnalyticsChannelsSplitParams,
): Promise<ChannelsSplitResponse> {
  const range = periodToRange(params.period);

  const fromDate =
    parseDateOrNull(params.from) ??
    range?.from ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const toDate = parseDateOrNull(params.to) ?? range?.to ?? new Date();

  const deptId = params.dept?.trim() || null;       // uuid
  const channelId = params.channel?.trim() || null; // uuid
  const queueId = params.queue?.trim() || null;     // uuid
  const q = params.q?.trim() || null;

  const splitSql = `
    select
      ch.code as channel_code,
      coalesce(ch.name, ch.code) as channel_name,
      count(*) filter (where c."callDirection" = 'incoming')::int as incoming,
      count(*) filter (where c."callDirection" = 'outgoing')::int as outgoing
    from cc_replica."Call" c
    left join cc_replica."Channel" ch on ch.id = c.channel_id
    left join cc_replica."User" u on u.id = c.user_id
    where c."createdOn" >= $1::timestamp
      and c."createdOn" <  $2::timestamp
      and ($3::uuid is null or u.department_id = $3::uuid)
      and ($4::uuid is null or c.channel_id = $4::uuid)
      and ($5::uuid is null or c.queue_id = $5::uuid)
      and ($6::text is null or c."requestNum" ilike '%' || $6 || '%')
    group by ch.code, ch.name
    order by incoming desc
  `;

  const { rows } = await query<{
    channel_code: string | null;
    channel_name: string | null;
    incoming: number;
    outgoing: number;
  }>(splitSql, [fromDate.toISOString(), toDate.toISOString(), deptId, channelId, queueId, q]);

  const split: ChannelsSplitItem[] = rows.map((r) => ({
    channelCode: r.channel_code ?? "voice",
    channelNameRu: r.channel_name ?? "Звонки",
    incoming: Number(r.incoming) || 0,
    outgoing: Number(r.outgoing) || 0,
    responseSec: null, // нет событий "первого ответа" в текущей модели
  }));

  // В текущей модели cc_replica нет response_time_sec по каналам.
  // Поэтому пока возвращаем пустой тренд (как в твоём v2).
  const responseTrend: ChannelResponseTrendPoint[] = [];

  return { split, responseTrend };
}
