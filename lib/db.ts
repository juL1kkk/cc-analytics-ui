import { Pool } from "pg";

let pool: Pool | null = null;

type DbRow = Record<string, unknown>;

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connString =
    process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

  if (!connString) {
    throw new Error("DATABASE_URL is not set");
  }

  pool = new Pool({ connectionString: connString });
  return pool;
}

export async function query(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: DbRow[] }> {
  const result = await getPool().query(sql, params);
  return { rows: result.rows };
}
