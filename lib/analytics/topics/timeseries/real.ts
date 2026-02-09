export type AnalyticsTopicsTimeSeriesParams = {
  period?: string;
  from?: string;
  to?: string;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
  topicFilter: string;
};

export type TopicTimeSeriesPoint = {
  t: string;
  incoming: number;
  missed: number;
};

export type TopicTimeSeriesResponse = {
  topic: string;
  items: TopicTimeSeriesPoint[];
};

export async function getTopicTimeSeries(
  params: AnalyticsTopicsTimeSeriesParams,
): Promise<TopicTimeSeriesResponse> {
  const toDate = params.to ? new Date(params.to) : new Date();
  const fromDate = params.from
    ? new Date(params.from)
    : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

  const filters: string[] = ["started_at >= $1", "started_at <= $2"];
  const values: Array<string | number | Date> = [fromDate, toDate];

  if (params.dept) {
    values.push(Number(params.dept));
    filters.push(`department_id = $${values.length}`);
  }

  if (params.channel) {
    values.push(Number(params.channel));
    filters.push(`channel_id = $${values.length}`);
  }

  if (params.queue) {
    values.push(Number(params.queue));
    filters.push(`queue_id = $${values.length}`);
  }

  if (params.topicFilter !== "all") {
    values.push(Number(params.topicFilter));
    filters.push(`topic_id = $${values.length}`);
  }

  const { query } = await import("@/lib/db");
  const { rows } = await query<{
    t: Date | string;
    incoming: number | string;
    missed: number | string;
  }>(
    `
      SELECT
        date_trunc('hour', started_at) AS t,
        COUNT(*) AS incoming,
        COUNT(*) FILTER (
          WHERE status = 'unresolved'
           AND ended_at IS NULL
        ) AS missed

      FROM interactions
      WHERE ${filters.join(" AND ")}
      GROUP BY t
      ORDER BY t ASC
    `,
    values,
  );

  const items = rows.map((row) => ({
    t: new Date(row.t).toISOString(),
    incoming: Number(row.incoming),
    missed: Number(row.missed),
  }));

  return {
    topic: params.topicFilter,
    items,
  };
}
