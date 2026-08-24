import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

const databaseUrl = resolveDatabaseUrl();

export function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}

export function getSql(fetchOptions?: RequestInit) {
  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl, fetchOptions ? { fetchOptions } : undefined);
}
