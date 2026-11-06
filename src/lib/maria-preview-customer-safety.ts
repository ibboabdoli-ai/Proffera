import { resolvePreviewEmailRecipient } from "@/lib/email-runtime-config";

/**
 * Preview customer email routes must never deliver to real customer
 * recipients, or point verification management links to Production.
 */
export function isMariaPreviewTestRecipient(email: string, env: NodeJS.ProcessEnv = process.env) {
  const approved = env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase();
  // All Preview Brevo requests are rewritten to the global Preview inbox.
  // If that effective destination differs from Maria's approved QA inbox,
  // reject the operation BEFORE it creates a hold or sends any email.
  const effectiveRecipient = resolvePreviewEmailRecipient(env);
  return env.VERCEL_ENV === "preview" && Boolean(approved)
    && effectiveRecipient === approved
    && email.trim().toLowerCase() === approved;
}

/**
 * Resolve the managed Vercel Preview origin used by Maria's QA-only links.
 * Returns null outside Preview or when the deployment hostname is invalid.
 * The deployment-provided VERCEL_URL is the trust anchor, not user input.
 */
export function getMariaPreviewPortalBase(env: NodeJS.ProcessEnv = process.env) {
  const host = env.VERCEL_URL?.trim();
  if (env.VERCEL_ENV !== "preview" || !host
    || !/^[a-z0-9][a-z0-9.-]*\.vercel\.app$/i.test(host)) return null;
  return `https://${host}`;
}
