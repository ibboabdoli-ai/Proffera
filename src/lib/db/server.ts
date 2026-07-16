import { neon } from "@neondatabase/serverless";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

export function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}

export function getSql() {
  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl);
}
