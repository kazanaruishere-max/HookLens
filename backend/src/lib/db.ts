import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

export function createDb(databaseUrl: string) {
  // Do not globally cache the connection to avoid Cloudflare Worker cross-request TCP socket errors
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
