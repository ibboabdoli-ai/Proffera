const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

function databaseTargetIdentity(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
    const isPostgresProtocol = url.protocol === "postgres:" || url.protocol === "postgresql:";
    const normalizedPort = url.port || (isPostgresProtocol ? "5432" : "");
    const port = normalizedPort ? `:${normalizedPort}` : "";
    return `${hostname}${port}${url.pathname}`;
  } catch {
    return value.trim();
  }
}

function previewDatabaseOverlapsSharedDatabase(
  previewDatabaseUrl: string,
  env: NodeJS.ProcessEnv,
) {
  const previewIdentity = databaseTargetIdentity(previewDatabaseUrl);

  return DATABASE_URL_ENV_KEYS.some((key) => {
    const sharedDatabaseUrl = env[key]?.trim();
    return Boolean(
      sharedDatabaseUrl
      && databaseTargetIdentity(sharedDatabaseUrl) === previewIdentity,
    );
  });
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "preview") {
    const previewDatabaseUrl = env.PROFFERA_PREVIEW_DATABASE_URL?.trim();
    if (!previewDatabaseUrl) return null;

    if (previewDatabaseOverlapsSharedDatabase(previewDatabaseUrl, env)) {
      return null;
    }

    return previewDatabaseUrl;
  }

  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}
