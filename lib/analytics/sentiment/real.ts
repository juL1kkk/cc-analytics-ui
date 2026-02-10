import { query } from "@/lib/db";

export type AnalyticsSentimentParams = {
  from?: string;
  to?: string;
  status?: string;
  active?: string;
  q?: string;
};

export type DonutSlice = {
  nameRu: string;
  value: number;
};

export type SentimentResponse = {
  items: DonutSlice[];
  total: number;
};

type WmtSource = {
  tableSchema: string;
  tableName: string;
  createdCol: string;
  communicationColorCol: string;
  statusCol?: string;
  activeCol?: string;
};

function parseDateOrNull(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBooleanOrNull(value?: string): boolean | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;

  return null;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function detectWmtSource(): Promise<WmtSource> {
  const sql = `
    WITH ranked AS (
      SELECT
        c.table_schema AS "tableSchema",
        c.table_name AS "tableName",
        MAX(CASE WHEN lower(c.column_name) IN ('communicationcolor', 'communication_color') THEN c.column_name END) AS "communicationColorCol",
        MAX(CASE WHEN lower(c.column_name) IN ('createdon', 'created_on') THEN c.column_name END) AS "createdCol",
        MAX(CASE WHEN lower(c.column_name) = 'status' THEN c.column_name END) AS "statusCol",
        MAX(CASE WHEN lower(c.column_name) = 'active' THEN c.column_name END) AS "activeCol",
        (
          CASE WHEN MAX(CASE WHEN lower(c.column_name) IN ('communicationcolor', 'communication_color') THEN 1 ELSE 0 END) = 1 THEN 100 ELSE 0 END
          + CASE WHEN MAX(CASE WHEN lower(c.column_name) IN ('createdon', 'created_on') THEN 1 ELSE 0 END) = 1 THEN 100 ELSE 0 END
          + CASE WHEN MAX(CASE WHEN lower(c.column_name) = 'status' THEN 1 ELSE 0 END) = 1 THEN 10 ELSE 0 END
          + CASE WHEN MAX(CASE WHEN lower(c.column_name) = 'active' THEN 1 ELSE 0 END) = 1 THEN 10 ELSE 0 END
          + CASE WHEN c.table_name ILIKE '%wmt%' THEN 5 ELSE 0 END
          + CASE WHEN c.table_name ILIKE '%response%' THEN 3 ELSE 0 END
        ) AS score
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      GROUP BY c.table_schema, c.table_name
    )
    SELECT
      "tableSchema",
      "tableName",
      "communicationColorCol",
      "createdCol",
      "statusCol",
      "activeCol"
    FROM ranked
    WHERE "communicationColorCol" IS NOT NULL
      AND "createdCol" IS NOT NULL
    ORDER BY score DESC, "tableName" ASC
    LIMIT 1
  `;

  const { rows } = await query<WmtSource>(sql);
  const source = rows[0];

  if (!source) {
    throw new Error(
      "WMT responses table not found in schema public (need communicationColor + createdOn/created_on columns)",
    );
  }

  return source;
}

export async function getSentiment(
  params: AnalyticsSentimentParams,
): Promise<SentimentResponse> {
  const fromDate =
    parseDateOrNull(params.from) ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const toDate = parseDateOrNull(params.to) ?? new Date();

  if (fromDate >= toDate) {
    throw new Error("Invalid range: `from` must be earlier than `to`");
  }

  const source = await detectWmtSource();
  const qualifiedTable = `${quoteIdentifier(source.tableSchema)}.${quoteIdentifier(source.tableName)}`;

  const createdCol = quoteIdentifier(source.createdCol);
  const communicationColorCol = quoteIdentifier(source.communicationColorCol);
  const statusCol = source.statusCol ? quoteIdentifier(source.statusCol) : null;
  const activeCol = source.activeCol ? quoteIdentifier(source.activeCol) : null;

  const cteSql = `
    SELECT
      ${createdCol} AS "createdOn",
      ${communicationColorCol} AS "communicationColor",
      ${statusCol ? `${statusCol}::text` : `NULL::text`} AS "status",
      ${activeCol ? `${activeCol}::boolean` : `NULL::boolean`} AS "active"
    FROM ${qualifiedTable}
  `;

  const where: string[] = [
    `w."createdOn" >= $1`,
    `w."createdOn" < $2`,
    `lower(COALESCE(w."communicationColor"::text, '')) IN ('red', 'yellow', 'green')`,
  ];
  const values: unknown[] = [fromDate.toISOString(), toDate.toISOString()];

  if (source.statusCol) {
    const statusValue = params.status?.trim() || "success";
    values.push(statusValue);
    where.push(`lower(COALESCE(w."status", '')) = lower($${values.length}::text)`);
  }

  if (source.activeCol) {
    const activeValue = parseBooleanOrNull(params.active) ?? true;
    values.push(activeValue);
    where.push(`w."active" = $${values.length}::boolean`);
  }

  const dataSql = `
    WITH wmt AS (
      ${cteSql}
    )
    SELECT
      CASE
        WHEN lower(w."communicationColor"::text) = 'red' THEN 'Негатив'
        WHEN lower(w."communicationColor"::text) = 'yellow' THEN 'Нейтрально'
        WHEN lower(w."communicationColor"::text) = 'green' THEN 'Позитив'
        ELSE NULL
      END AS "nameRu",
      COUNT(*)::int AS "value"
    FROM wmt w
    WHERE ${where.join(" AND ")}
    GROUP BY 1
  `;

  const { rows } = await query<DonutSlice>(dataSql, values);

  const valueByName = new Map(rows.map((row) => [row.nameRu, Number(row.value) || 0]));

  const orderedItems: DonutSlice[] = [
    { nameRu: "Негатив", value: valueByName.get("Негатив") ?? 0 },
    { nameRu: "Нейтрально", value: valueByName.get("Нейтрально") ?? 0 },
    { nameRu: "Позитив", value: valueByName.get("Позитив") ?? 0 },
  ];

  const items = orderedItems.filter((item) => item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return { items, total };
}
