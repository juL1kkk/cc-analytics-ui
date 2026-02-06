const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRange = {
  from: Date;
  to: Date;
  period: string;
};

export type FilterBuild = {
  cte: string;
  values: (string | number | Date)[];
  from: Date;
  to: Date;
  period: string;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parseDateRange(params: URLSearchParams): DateRange | null {
  const period = params.get("period") ?? "today";
  const now = new Date();

  if (period === "custom") {
    const from = parseDate(params.get("from"));
    const to = parseDate(params.get("to"));
    if (!from || !to || from >= to) {
      return null;
    }
    return { from, to, period };
  }

  if (period === "yesterday") {
    const to = startOfDay(now);
    const from = new Date(to.getTime() - DAY_MS);
    return { from, to, period };
  }

  if (period === "7d") {
    const to = now;
    const from = new Date(now.getTime() - 7 * DAY_MS);
    return { from, to, period };
  }

  if (period === "30d") {
    const to = now;
    const from = new Date(now.getTime() - 30 * DAY_MS);
    return { from, to, period };
  }

  const from = startOfDay(now);
  const to = now;
  return { from, to, period: "today" };
}

export function resolveGranularity(
  params: URLSearchParams,
  range: DateRange,
) {
  const requested = params.get("granularity");
  if (requested === "hour" || requested === "day") {
    return requested;
  }

  if (range.period === "today" || range.period === "yesterday") {
    return "hour";
  }

  const spanMs = range.to.getTime() - range.from.getTime();
  return spanMs <= 7 * DAY_MS ? "hour" : "day";
}

export function parseLimitOffset(
  params: URLSearchParams,
  defaults: { limit: number; offset: number } = { limit: 50, offset: 0 },
) {
  const limitParam = params.get("limit");
  const offsetParam = params.get("offset");
  const limit = limitParam ? Number(limitParam) : defaults.limit;
  const offset = offsetParam ? Number(offsetParam) : defaults.offset;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return null;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return null;
  }
  return { limit, offset };
}

export function buildFilteredCte(params: URLSearchParams): FilterBuild | null {
  const range = parseDateRange(params);
  if (!range) return null;

  const values: (string | number | Date)[] = [range.from, range.to];
  const conditions = ["i.started_at >= $1", "i.started_at < $2"];

  const dept = params.get("dept");
  if (dept) {
    values.push(dept);
    const idx = values.length;
    conditions.push(`(d.department_code = $${idx} OR d.id::text = $${idx})`);
  }

  const channel = params.get("channel");
  if (channel) {
    values.push(channel);
    const idx = values.length;
    conditions.push(`(c.channel_code = $${idx} OR c.id::text = $${idx})`);
  }

  const queue = params.get("queue");
  if (queue) {
    values.push(queue);
    const idx = values.length;
    conditions.push(`(q.queue_code = $${idx} OR q.id::text = $${idx})`);
  }

  const topic = params.get("topic");
  if (topic && topic !== "all") {
    values.push(topic);
    const idx = values.length;
    conditions.push(`(t.topic_code = $${idx} OR t.id::text = $${idx})`);
  }

  const search = params.get("q");
  if (search) {
    values.push(`%${search}%`);
    const idx = values.length;
    conditions.push(
      `(i.external_id ILIKE $${idx} OR COALESCE(o.full_name_ru, '') ILIKE $${idx} OR COALESCE(t.name_ru, '') ILIKE $${idx})`,
    );
  }

  const cte = `
    WITH filtered AS (
      SELECT
        i.*, c.channel_code, c.name_ru AS channel_name_ru,
        q.queue_code, q.name_ru AS queue_name_ru,
        d.department_code, d.name_ru AS department_name_ru,
        o.full_name_ru AS operator_name_ru,
        t.topic_code, t.name_ru AS topic_name_ru
      FROM interactions i
      JOIN channels c ON c.id = i.channel_id
      JOIN queues q ON q.id = i.queue_id
      JOIN departments d ON d.id = i.department_id
      LEFT JOIN operators o ON o.id = i.operator_id
      LEFT JOIN topics t ON t.id = i.topic_id
      WHERE ${conditions.join(" AND ")}
    )
  `;

  return { cte, values, from: range.from, to: range.to, period: range.period };
}

export function formatTime(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}
