const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

const NODE_POSTGRES_PROTOCOLS = new Set([
  "pg:",
  "postgres:",
  "postgresql:",
]);

const NODE_POSTGRES_STRICT_SSL_ALIASES = new Set([
  "prefer",
  "require",
  "verify-ca",
]);

function databaseTargetIdentity(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
    const isPostgresProtocol = NODE_POSTGRES_PROTOCOLS.has(url.protocol);
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

export function normalizeNodePostgresSslMode(value: string) {
  try {
    const url = new URL(value);
    if (!NODE_POSTGRES_PROTOCOLS.has(url.protocol)) {
      return value;
    }

    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    if (!sslMode || !NODE_POSTGRES_STRICT_SSL_ALIASES.has(sslMode)) {
      return value;
    }

    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  } catch {
    return value;
  }
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

export function resolveNodePostgresDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const databaseUrl = resolveDatabaseUrl(env);
  return databaseUrl ? normalizeNodePostgresSslMode(databaseUrl) : null;
}
