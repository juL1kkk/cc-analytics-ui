import { Pool } from "pg";

type GlobalPool = typeof globalThis & { pgPool?: Pool };

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL не задан.");
  }

  const globalPool = globalThis as GlobalPool;

  if (!globalPool.pgPool) {
    globalPool.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return globalPool.pgPool;
}

export async function query<T>(text: string, params?: Array<string | number | boolean | null>) {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

export async function getClient() {
  const currentPool = getPool();
  return currentPool.connect();
}
