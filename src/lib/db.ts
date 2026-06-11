// Postgres pool for DigitalOcean Managed Postgres.
// Singleton across hot reloads / serverless invocations on the same instance.
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    global.__pgPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false }, // DO managed PG uses a cluster CA; require encrypted transport
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
