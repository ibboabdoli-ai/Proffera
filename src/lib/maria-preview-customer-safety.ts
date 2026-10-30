/**
 * Preview customer email routes must never deliver to real customer
 * recipients, or point verification management links to Production.
 */
export function isMariaPreviewTestRecipient(email: string, env: NodeJS.ProcessEnv = process.env) {
  const approved = env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase();
  return env.VERCEL_ENV === "preview" && Boolean(approved)
    && email.trim().toLowerCase() === approved;
}

export function getMariaPreviewPortalBase(env: NodeJS.ProcessEnv = process.env) {
  const host = env.VERCEL_URL?.trim();
  if (env.VERCEL_ENV !== "preview" || !host
    || !/^[a-z0-9][a-z0-9.-]*\.vercel\.app$/i.test(host)) return null;
  return `https://${host}`;
}
