import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

const databaseUrl = resolveDatabaseUrl();

export function hasDatabaseConfig() {
  return Boolean(databaseUrl);
}

export function getSql(options?: { signal?: AbortSignal }) {
  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl, options?.signal ? { fetchOptions: { signal: options.signal } } : undefined);
}
