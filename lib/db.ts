import { Pool } from "pg";

let pool: Pool | null = null;

const getPool = (): Pool => {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }

    pool = new Pool({ connectionString });
  }

  return pool;
};

export const query = async <T>(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> => {
  const activePool = getPool();

  return activePool.query<T>(sql, params);
};
