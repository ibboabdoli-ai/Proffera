const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "preview") {
    const previewDatabaseUrl = env.PROFFERA_PREVIEW_DATABASE_URL?.trim();
    return previewDatabaseUrl || null;
  }

  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}
