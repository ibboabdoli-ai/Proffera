import { betterAuth } from "better-auth";
import { Pool } from "pg";

import { resolvePreviewAuthOriginConfig } from "@/lib/auth-origin";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { resolveNodePostgresDatabaseUrl } from "@/lib/db/database-url";

function createAuth() {
  const databaseUrl = resolveNodePostgresDatabaseUrl();
  const authSecret = resolveAuthSecret();
  const previewAuthOriginConfig = resolvePreviewAuthOriginConfig();

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
    ...(previewAuthOriginConfig ?? {}),
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
