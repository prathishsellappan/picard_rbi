import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { getServerConfig } from "./config";

// One pool per server process. Kept on globalThis so dev hot-reload doesn't leak connections.
const globalForDb = globalThis as unknown as { picardPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.picardPool) {
    // Serverless hosts (Vercel) run many small instances: keep each pool small so a hosted
    // Postgres (e.g. Supabase's pooler) isn't exhausted.
    const max = process.env.VERCEL ? 3 : 10;
    globalForDb.picardPool = new Pool({ connectionString: getServerConfig().databaseUrl, max });
  }
  return globalForDb.picardPool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export type QueryFn = <T extends QueryResultRow>(text: string, params?: unknown[]) => Promise<T[]>;

// Runs fn inside BEGIN/COMMIT on a single connection; rolls back if it throws.
export async function transaction<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const q: QueryFn = async (text, params = []) => (await client.query(text, params)).rows;
  try {
    await client.query("BEGIN");
    const result = await fn(q);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Runs fn with one dedicated connection (for code that manages its own BEGIN/COMMIT).
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
