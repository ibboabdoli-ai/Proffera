import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

export function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}

export function getSql() {
  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl);
}
