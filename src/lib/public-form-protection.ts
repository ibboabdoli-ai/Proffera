import "server-only";

import { createHash } from "node:crypto";

import { getSql } from "@/lib/db/server";
import { resolvePublicFormRateLimitSecret } from "@/lib/public-form-rate-limit-secret";

type RateLimitInput = {
  scope: string;
  requestHeaders: Headers;
  identity?: string;
  maxAttempts: number;
  windowSeconds: number;
};

function clientAddress(requestHeaders: Headers) {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

function fingerprint(
  { scope, requestHeaders, identity = "" }: Pick<RateLimitInput, "scope" | "requestHeaders" | "identity">,
  secret: string,
) {
  const normalizedIdentity = identity.trim().toLowerCase();
  return createHash("sha256")
    .update(`${secret}:${scope}:${clientAddress(requestHeaders)}:${normalizedIdentity}`)
    .digest("hex");
}

export async function allowPublicSubmission(input: RateLimitInput) {
  const secret = resolvePublicFormRateLimitSecret();
  const sql = getSql();

  if (!secret || !sql || input.maxAttempts < 1 || input.windowSeconds < 1) {
    return false;
  }

  try {
    const rows = await sql`
      insert into public_submission_rate_limits (
        scope,
        fingerprint,
        window_started_at,
        attempts,
        created_at,
        updated_at
      )
      values (
        ${input.scope},
        ${fingerprint(input, secret)},
        now(),
        1,
        now(),
        now()
      )
      on conflict (scope, fingerprint)
      do update set
        attempts = case
          when public_submission_rate_limits.window_started_at <= now() - (${input.windowSeconds} * interval '1 second') then 1
          else public_submission_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public_submission_rate_limits.window_started_at <= now() - (${input.windowSeconds} * interval '1 second') then now()
          else public_submission_rate_limits.window_started_at
        end,
        updated_at = now()
      returning attempts
    `;

    return Number(rows[0]?.attempts ?? input.maxAttempts + 1) <= input.maxAttempts;
  } catch (error) {
    console.error("Failed to apply public form rate limit", error);
    return false;
  }
}
