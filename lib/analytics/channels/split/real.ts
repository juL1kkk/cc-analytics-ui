import { query } from "@/lib/db";

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

function parseDateOrNull(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIntOrNull(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type ChannelSlot = "voice" | "chat" | "email" | "sms" | "push";

function mapChannelNameToSlot(name: string): ChannelSlot | null {
  const n = name.toLowerCase();
  if (n.includes("звон")) return "voice";
  if (n.includes("чат")) return "chat";
  if (n.includes("email") || n.includes("почт")) return "email";
  if (n.includes("sms")) return "sms";
  if (n.includes("push")) return "push";
  return null;
}

export async function getChannelsSplit(
  params: AnalyticsChannelsSplitParams,
): Promise<ChannelsSplitResponse> {
  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  const deptId = parseIntOrNull(params.dept);
  const channelId = parseIntOrNull(params.channel);
  const queueId = parseIntOrNull(params.queue);
  const topicId = parseIntOrNull(params.topic);

  // ---- split by channel ----
  const where: string[] = [`i.started_at >= $1`, `i.started_at < $2`];
  const values: unknown[] = [fromDate.toISOString(), toDate.toISOString()];
  let idx = values.length;

  if (deptId !== null) {
    idx += 1;
    where.push(`i.department_id = $${idx}`);
    values.push(deptId);
  }
  if (channelId !== null) {
    idx += 1;
    where.push(`i.channel_id = $${idx}`);
    values.push(channelId);
  }
  if (queueId !== null) {
    idx += 1;
    where.push(`i.queue_id = $${idx}`);
    values.push(queueId);
  }
  if (topicId !== null) {
    idx += 1;
    where.push(`i.topic_id = $${idx}`);
    values.push(topicId);
  }

  const splitSql = `
    SELECT
      c.name AS "channelNameRu",
      c.name AS "channelCode",
      COUNT(*)::int AS "incoming",
      ROUND(AVG(i.response_time_sec))::int AS "responseSec"
    FROM public.interactions i
    JOIN public.channels c ON c.id = i.channel_id
    WHERE ${where.join(" AND ")}
    GROUP BY c.name
    ORDER BY COUNT(*) DESC, c.name ASC
  `;

  const { rows: splitRows } = await query<{
    channelNameRu: string;
    channelCode: string;
    incoming: number;
    responseSec: number | null;
  }>(splitSql, values);

  const split: ChannelsSplitItem[] = splitRows.map((r) => ({
    channelCode: r.channelCode,
    channelNameRu: r.channelNameRu,
    incoming: Number(r.incoming) || 0,
    outgoing: null, // direction нет в текущей interactions схеме
    responseSec: r.responseSec === null ? null : Number(r.responseSec),
  }));

  // ---- response trend (multi-channel): per-hour avg response_time_sec by channel ----
  // Load channels once, build mapping channel_id -> slot
  const { rows: chanRows } = await query<{ id: number; name: string }>(
    `SELECT id, name FROM public.channels ORDER BY id ASC`,
  );

  const channelSlotById = new Map<number, ChannelSlot>();
  for (const c of chanRows) {
    const slot = mapChannelNameToSlot(c.name);
    if (slot) channelSlotById.set(Number(c.id), slot);
  }

  let responseTrend: ChannelResponseTrendPoint[] = [];
  if (channelSlotById.size > 0) {
    const w3: string[] = [`i.started_at >= $1`, `i.started_at < $2`];
    const v3: unknown[] = [fromDate.toISOString(), toDate.toISOString()];
    let k = v3.length;

    if (deptId !== null) {
      k += 1;
      w3.push(`i.department_id = $${k}`);
      v3.push(deptId);
    }
    if (queueId !== null) {
      k += 1;
      w3.push(`i.queue_id = $${k}`);
      v3.push(queueId);
    }
    if (topicId !== null) {
      k += 1;
      w3.push(`i.topic_id = $${k}`);
      v3.push(topicId);
    }
    // If channel filter provided, trend will only include that channel (still mapped to slot)
    if (channelId !== null) {
      k += 1;
      w3.push(`i.channel_id = $${k}`);
      v3.push(channelId);
    }

    const trendSql = `
      SELECT
        date_trunc('hour', i.started_at) AS bucket,
        i.channel_id AS channel_id,
        ROUND(AVG(i.response_time_sec))::int AS v
      FROM public.interactions i
      WHERE ${w3.join(" AND ")}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    const { rows: trendRows } = await query<{
      bucket: string | Date;
      channel_id: number;
      v: number | null;
    }>(trendSql, v3);

    const byT = new Map<string, ChannelResponseTrendPoint>();

    for (const r of trendRows) {
      const d = r.bucket instanceof Date ? r.bucket : new Date(r.bucket);
      const t = d.toISOString();

      let p = byT.get(t);
      if (!p) {
        p = { t };
        byT.set(t, p);
      }

      const slot = channelSlotById.get(Number(r.channel_id));
      if (!slot) continue;

      const val = r.v === null ? null : Number(r.v);
      if (slot === "voice") p.voice = val;
      else if (slot === "chat") p.chat = val;
      else if (slot === "email") p.email = val;
      else if (slot === "sms") p.sms = val;
      else if (slot === "push") p.push = val;
    }

    responseTrend = Array.from(byT.values()).sort((a, b) => a.t.localeCompare(b.t));
  }

  return { split, responseTrend };
}
