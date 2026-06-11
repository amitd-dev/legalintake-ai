// Postgres pool for DigitalOcean Managed Postgres.
// Singleton across hot reloads / serverless invocations on the same instance.
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new Error("DATABASE_URL is not configured");
    // Strip sslmode from the URL: pg's connection-string parser would otherwise
    // override our ssl config and reject DO's cluster CA as self-signed.
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    global.__pgPool = new Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false }, // encrypted transport; DO uses a cluster CA
      max: 3 // serverless: keep the per-instance footprint small
    });
  }
  return global.__pgPool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
