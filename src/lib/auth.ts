import { betterAuth } from "better-auth";
import { Pool } from "pg";

type ProfferaAuth = ReturnType<typeof betterAuth>;

let authInstance: ProfferaAuth | null = null;

export function getAuth() {
  if (authInstance) return authInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before Proffera auth can be initialized.");
  }

  authInstance = betterAuth({
    database: new Pool({ connectionString }),
    emailAndPassword: {
      enabled: true,
    },
  });

  return authInstance;
}
