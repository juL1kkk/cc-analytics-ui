import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

let pool: Pool | undefined;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool() {
  if (process.env.NODE_ENV !== "production") {
    if (!globalThis.pgPool) {
      globalThis.pgPool = createPool();
    }
    return globalThis.pgPool;
  }

  if (!pool) {
    pool = createPool();
  }

  return pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]) {
  const dbPool = getPool();
  return dbPool.query<T>(text, params);
}
