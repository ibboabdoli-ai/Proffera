import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

const databaseUrl = resolveDatabaseUrl();

export function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}

export function getSql() {
  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl);
}
