import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

function createAuth() {
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or a supported Postgres fallback is required to initialize Proffera auth.",
    );
  }

  return betterAuth({
    database: new Pool({
      connectionString: databaseUrl,
    }),
    emailAndPassword: {
      enabled: true,
    },
  });
}

let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
}

export const authIntegrationStatus = "configured-not-routed" as const;
