import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { resolveAuthSecret } from "@/lib/auth-secret";
import { resolveDatabaseUrl } from "@/lib/db/database-url";

function createAuth() {
  const databaseUrl = resolveDatabaseUrl();
  const authSecret = resolveAuthSecret();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or a supported Postgres fallback is required to initialize Proffera auth.",
    );
  }

  if (!authSecret) {
    throw new Error(
      process.env.VERCEL_ENV === "preview"
        ? "PROFFERA_PREVIEW_AUTH_SECRET is required to initialize Proffera auth in Preview."
        : "BETTER_AUTH_SECRET or AUTH_SECRET is required to initialize Proffera auth.",
    );
  }

  return betterAuth({
    secret: authSecret,
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
