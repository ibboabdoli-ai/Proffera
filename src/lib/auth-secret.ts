const AUTH_SECRET_ENV_KEYS = ["BETTER_AUTH_SECRET", "AUTH_SECRET"] as const;

export function resolveAuthSecret(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "preview") {
    const previewSecret = env.PROFFERA_PREVIEW_AUTH_SECRET?.trim();
    return previewSecret || null;
  }

  for (const key of AUTH_SECRET_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }

  return null;
}
