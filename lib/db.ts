import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

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

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  const result = await getPool().query<T>(sql, params);
  return { rows: result.rows };
}
