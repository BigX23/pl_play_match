import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-side Postgres client (postgres.js + Drizzle).
 * Lazily initialized so importing this module in environments without a
 * DATABASE_URL (tests, mock mode) doesn't open a connection.
 */

let _db: ReturnType<typeof buildDb> | null = null;

function buildDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[PlayMatch] DATABASE_URL is not set");
  }
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

export function getDb() {
  if (!_db) _db = buildDb();
  return _db;
}

export const isDbConfigured = () => Boolean(process.env.DATABASE_URL);

export { schema };
