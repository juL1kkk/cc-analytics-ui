import { z } from "zod";

const periodSchema = z.enum(["today", "yesterday", "7d", "30d", "custom"]);

const baseAnalyticsSchema = z
  .object({
    period: periodSchema.optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    dept: z.string().optional(),
    channel: z.string().optional(),
    queue: z.string().optional(),
    topic: z.string().optional(),
    q: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.period === "custom" && (!value.from || !value.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для period=custom нужны параметры from и to.",
      });
    }
  });

export type AnalyticsFilters = {
  period: z.infer<typeof periodSchema>;
  from: Date;
  to: Date;
  dept?: string;
  channel?: string;
  queue?: string;
  topic?: string;
  q?: string;
};

export type Pagination = {
  limit: number;
  offset: number;
};

const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .pipe(z.number().int().min(1).max(500).optional()),
  offset: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .pipe(z.number().int().min(0).optional()),
});

export const analyticsQuerySchema = baseAnalyticsSchema;

export function parseAnalyticsFilters(searchParams: URLSearchParams) {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = analyticsQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error };
  }

  const period = parsed.data.period ?? "today";
  const { from, to } = resolvePeriodRange(period, parsed.data.from, parsed.data.to);

  return {
    ok: true as const,
    data: {
      period,
      from,
      to,
      dept: parsed.data.dept,
      channel: parsed.data.channel,
      queue: parsed.data.queue,
      topic: parsed.data.topic,
      q: parsed.data.q,
    },
  };
}

export function parsePagination(searchParams: URLSearchParams) {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = paginationSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error };
  }

  return {
    ok: true as const,
    data: {
      limit: parsed.data.limit ?? 50,
      offset: parsed.data.offset ?? 0,
    },
  };
}

export function resolveGranularity(
  period: AnalyticsFilters["period"],
  granularity: string | null,
) {
  if (granularity && granularity !== "auto") {
    return granularity === "hour" ? "hour" : "day";
  }

  if (period === "today" || period === "yesterday" || period === "7d") {
    return "hour";
  }

  return "day";
}

export function buildFilteredCte(filters: AnalyticsFilters) {
  const values: Array<string | number | boolean | null | Date> = [
    filters.from,
    filters.to,
    filters.dept ?? null,
    filters.channel ?? null,
    filters.queue ?? null,
    filters.topic ?? null,
    filters.q ?? null,
  ];

  const sql = `WITH filtered AS (
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
    WHERE i.started_at >= $1
      AND i.started_at < $2
      AND ($3::text IS NULL OR d.department_code = $3 OR d.id::text = $3)
      AND ($4::text IS NULL OR c.channel_code = $4 OR c.id::text = $4)
      AND ($5::text IS NULL OR q.queue_code = $5 OR q.id::text = $5)
      AND ($6::text IS NULL OR $6::text = 'all' OR t.topic_code = $6 OR t.id::text = $6)
      AND (
        $7::text IS NULL
        OR i.external_id ILIKE '%' || $7 || '%'
        OR COALESCE(o.full_name_ru, '') ILIKE '%' || $7 || '%'
        OR COALESCE(t.name_ru, '') ILIKE '%' || $7 || '%'
      )
  )`;

  return { sql, values };
}

function resolvePeriodRange(period: AnalyticsFilters["period"], from?: string, to?: string) {
  if (period === "custom") {
    return {
      from: new Date(from as string),
      to: new Date(to as string),
    };
  }

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (period) {
    case "today":
      return { from: startOfToday, to: now };
    case "yesterday": {
      const fromDate = new Date(startOfToday);
      fromDate.setUTCDate(fromDate.getUTCDate() - 1);
      return { from: fromDate, to: startOfToday };
    }
    case "7d": {
      const fromDate = new Date(now);
      fromDate.setUTCDate(fromDate.getUTCDate() - 7);
      return { from: fromDate, to: now };
    }
    case "30d": {
      const fromDate = new Date(now);
      fromDate.setUTCDate(fromDate.getUTCDate() - 30);
      return { from: fromDate, to: now };
    }
    default:
      return { from: startOfToday, to: now };
  }
}
