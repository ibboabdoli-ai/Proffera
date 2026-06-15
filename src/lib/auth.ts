import { betterAuth } from "better-auth";
import { Pool } from "pg";

function createAuth() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Proffera auth.");
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
