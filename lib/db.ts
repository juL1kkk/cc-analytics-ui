import { Pool } from "pg";

let pool: Pool | undefined;

function getPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

    if (!connectionString) {
      throw new Error(
        "Database connection string is not configured. Set DATABASE_URL or DATABASE_URL_UNPOOLED.",
      );
    }

    pool = new Pool({ connectionString });
  }

  return pool;
}

export async function query<T>(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  const result = await getPool().query<T>(sql, params);
  return { rows: result.rows };
}
