import { query } from "@/lib/db";

export type AnalyticsTopicsTopParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  limit?: number;
};

export type TopicTopItem = {
  topicId: number;
  topicNameRu: string;
  count: number;
  avgHandleSec: number | null;
  fcrPct: number | null;
};

export type DonutSlice = {
  nameRu: string;
  value: number;
};

export type TopicsTopResponse = {
  topTopics: TopicTopItem[];
  channelSplit: DonutSlice[];
  sentimentSplit: DonutSlice[] | null;
  goalSplit: DonutSlice[] | null;
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

export async function getTopicsTop(
  params: AnalyticsTopicsTopParams,
): Promise<TopicsTopResponse> {
  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  const deptId = parseIntOrNull(params.dept);
  const channelId = parseIntOrNull(params.channel);
  const queueId = parseIntOrNull(params.queue);
  const topicIdFilter = parseIntOrNull(params.topic);

  const limit = typeof params.limit === "number" && params.limit > 0 ? params.limit : 10;

  // ---- TOP TOPICS ----
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
  if (topicIdFilter !== null) {
    idx += 1;
    where.push(`i.topic_id = $${idx}`);
    values.push(topicIdFilter);
  }

  idx += 1;
  values.push(limit);

  const topSql = `
    SELECT
      t.id AS "topicId",
      t.name AS "topicNameRu",
      COUNT(*)::int AS "count",
      ROUND(AVG(i.duration_sec) FILTER (WHERE i.status = 'resolved' AND i.duration_sec > 0))::int AS "avgHandleSec",
      ROUND(100.0 * AVG(CASE WHEN i.fcr THEN 1 ELSE 0 END), 2)::float AS "fcrPct"
    FROM public.interactions i
    JOIN public.topics t ON t.id = i.topic_id
    WHERE ${where.join(" AND ")}
    GROUP BY t.id, t.name
    ORDER BY COUNT(*) DESC, t.id ASC
    LIMIT $${idx}
  `;

  const { rows: topRows } = await query<{
    topicId: number;
    topicNameRu: string;
    count: number;
    avgHandleSec: number | null;
    fcrPct: number | null;
  }>(topSql, values);

  const topTopics: TopicTopItem[] = topRows.map((r) => ({
    topicId: Number(r.topicId),
    topicNameRu: r.topicNameRu,
    count: Number(r.count) || 0,
    avgHandleSec: r.avgHandleSec === null ? null : Number(r.avgHandleSec),
    fcrPct: r.fcrPct === null ? null : Number(r.fcrPct),
  }));

  // Determine which topic to use for channelSplit:
  // - if params.topic provided -> use it
  // - else use top-1 topic from result
  const topicForSplit = topicIdFilter ?? (topTopics.length > 0 ? topTopics[0]!.topicId : null);

  // ---- CHANNEL SPLIT (donut) ----
  let channelSplit: DonutSlice[] = [];
  if (topicForSplit !== null) {
    const w2: string[] = [`i.started_at >= $1`, `i.started_at < $2`, `i.topic_id = $3`];
    const v2: unknown[] = [fromDate.toISOString(), toDate.toISOString(), topicForSplit];

    let j = v2.length;

    if (deptId !== null) {
      j += 1;
      w2.push(`i.department_id = $${j}`);
      v2.push(deptId);
    }
    if (channelId !== null) {
      j += 1;
      w2.push(`i.channel_id = $${j}`);
      v2.push(channelId);
    }
    if (queueId !== null) {
      j += 1;
      w2.push(`i.queue_id = $${j}`);
      v2.push(queueId);
    }

    const splitSql = `
      SELECT
        c.name AS "nameRu",
        COUNT(*)::int AS "value"
      FROM public.interactions i
      JOIN public.channels c ON c.id = i.channel_id
      WHERE ${w2.join(" AND ")}
      GROUP BY c.name
      ORDER BY COUNT(*) DESC, c.name ASC
    `;

    const { rows: splitRows } = await query<{ nameRu: string; value: number }>(splitSql, v2);

    channelSplit = splitRows.map((r) => ({
      nameRu: r.nameRu,
      value: Number(r.value) || 0,
    }));
  }

  return {
    topTopics,
    channelSplit,
    sentimentSplit: null,
    goalSplit: null,
  };
}