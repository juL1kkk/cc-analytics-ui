import { query } from "@/lib/db";

const ANALYTICS_TZ = "Europe/Amsterdam";

type PeriodKey = "today" | "yesterday" | "7d" | "30d";

type ResolvePeriodRangeInput = {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  fallbackFrom: Date;
  fallbackTo?: Date;
};

type ResolvePeriodRangeResult = {
  from: Date;
  to: Date;
};

function parseDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function periodConfig(period?: string | null): { fromOffsetDays: number; toOffsetDays: number } | null {
  switch (period as PeriodKey) {
    case "today":
      return { fromOffsetDays: 0, toOffsetDays: 1 };
    case "yesterday":
      return { fromOffsetDays: 1, toOffsetDays: 0 };
    case "7d":
      return { fromOffsetDays: 6, toOffsetDays: 1 };
    case "30d":
      return { fromOffsetDays: 29, toOffsetDays: 1 };
    default:
      return null;
  }
}

async function periodRangeFromDb(
  fromOffsetDays: number,
  toOffsetDays: number,
): Promise<ResolvePeriodRangeResult> {
  const { rows } = await query<{ from_ts: Date; to_ts: Date }>(
    `
      with local_now as (
        select now() at time zone $1 as local_now
      )
      select
        (
          date_trunc('day', local_now) - make_interval(days => $2::int)
        ) at time zone $1 as from_ts,
        (
          date_trunc('day', local_now) + make_interval(days => $3::int)
        ) at time zone $1 as to_ts
      from local_now
    `,
    [ANALYTICS_TZ, fromOffsetDays, toOffsetDays],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to resolve period range in database");
  }

  return { from: new Date(row.from_ts), to: new Date(row.to_ts) };
}

export async function resolveV2PeriodRange({
  period,
  from,
  to,
  fallbackFrom,
  fallbackTo = new Date(),
}: ResolvePeriodRangeInput): Promise<ResolvePeriodRangeResult> {
  const fromExplicit = parseDateOrNull(from);
  const toExplicit = parseDateOrNull(to);

  if (from || to) {
    const range = {
      from: fromExplicit ?? fallbackFrom,
      to: toExplicit ?? fallbackTo,
    };

    if (range.from >= range.to) {
      throw new Error("Invalid range: `from` must be earlier than `to`");
    }

    return range;
  }

  const config = periodConfig(period);
  if (config) {
    return periodRangeFromDb(config.fromOffsetDays, config.toOffsetDays);
  }

  const range = { from: fallbackFrom, to: fallbackTo };
  if (range.from >= range.to) {
    throw new Error("Invalid fallback range");
  }
  return range;
}

export { ANALYTICS_TZ };
