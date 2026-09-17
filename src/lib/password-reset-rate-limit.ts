import "server-only";

import { allowPublicSubmission } from "@/lib/public-form-protection";

export const PASSWORD_RESET_REQUEST_RATE_LIMIT = {
  windowSeconds: 15 * 60,
  maxAttempts: 5,
} as const;

export const PASSWORD_RESET_SUBMIT_RATE_LIMIT = {
  windowSeconds: 15 * 60,
  maxAttempts: 10,
} as const;

type PasswordResetRateLimitRule = {
  scope: string;
  windowSeconds: number;
  maxAttempts: number;
};

const PASSWORD_RESET_RATE_LIMIT_RULES: Record<string, PasswordResetRateLimitRule> = {
  "/api/auth/request-password-reset": {
    scope: "auth_password_reset_request",
    ...PASSWORD_RESET_REQUEST_RATE_LIMIT,
  },
  "/api/auth/reset-password": {
    scope: "auth_password_reset_submit",
    ...PASSWORD_RESET_SUBMIT_RATE_LIMIT,
  },
};

export type PasswordResetRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number | null;
};

export async function checkPasswordResetRateLimit(request: Request): Promise<PasswordResetRateLimitDecision> {
  const pathname = new URL(request.url).pathname;
  const rule = PASSWORD_RESET_RATE_LIMIT_RULES[pathname];

  if (!rule) {
    return { allowed: true, retryAfterSeconds: null };
  }

  const allowed = await allowPublicSubmission({
    scope: rule.scope,
    requestHeaders: request.headers,
    maxAttempts: rule.maxAttempts,
    windowSeconds: rule.windowSeconds,
  });

  return {
    allowed,
    retryAfterSeconds: allowed ? null : rule.windowSeconds,
  };
}
