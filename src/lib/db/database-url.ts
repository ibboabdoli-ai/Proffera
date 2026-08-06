const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

type DatabaseUrlEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveDatabaseUrl(env: DatabaseUrlEnvironment = process.env) {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}
