const LOCAL_DEVELOPMENT_FALLBACK = "proffera-public-form-rate-limit-v1";

export function resolvePublicFormRateLimitSecret(env: NodeJS.ProcessEnv = process.env) {
  const configuredSecret = env.PUBLIC_FORM_RATE_LIMIT_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  const isLocalDevelopment = !env.VERCEL_ENV && env.NODE_ENV !== "production";
  return isLocalDevelopment ? LOCAL_DEVELOPMENT_FALLBACK : null;
}
