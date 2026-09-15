import { getDatabase, type DatabaseConnection } from "@netlify/database";

let cached: DatabaseConnection | undefined;

/**
 * Netlify Database connection. `NETLIFY_DB_URL` is injected by the platform in
 * builds, functions and `netlify dev`, so no connection string is passed here.
 */
export function db(): DatabaseConnection {
  if (!cached) cached = getDatabase();
  return cached;
}

/** `db().sql` tagged-template shortcut. */
export function sql(): DatabaseConnection["sql"] {
  return db().sql;
}

export interface TxClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

/**
 * Runs `fn` inside a single BEGIN/COMMIT on one pooled connection. Needed for
 * `SELECT ... FOR UPDATE` paths (calculate, checkout, webhook unlock).
 */
export async function withTransaction<T>(
  fn: (client: TxClient) => Promise<T>,
): Promise<T> {
  const pool = db().pool as unknown as {
    connect(): Promise<
      TxClient & { release(): void }
    >;
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Connection already broken; the original error is what matters.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  const rows = await sql()<{ ok: number }>`SELECT 1 AS ok`;
  return rows.length === 1;
}
