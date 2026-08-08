import { describe, expect, it } from "vitest";

import { resolvePublicFormRateLimitSecret } from "../src/lib/public-form-rate-limit-secret";

describe("public form rate-limit secret policy", () => {
  it("uses the configured secret", () => {
    expect(resolvePublicFormRateLimitSecret({
      PUBLIC_FORM_RATE_LIMIT_SECRET: "  unique-secret  ",
      VERCEL_ENV: "production",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv)).toBe("unique-secret");
  });

  it("fails closed in production when the secret is missing", () => {
    expect(resolvePublicFormRateLimitSecret({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("fails closed in preview when the secret is missing", () => {
    expect(resolvePublicFormRateLimitSecret({
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("keeps a deterministic fallback only for local development", () => {
    expect(resolvePublicFormRateLimitSecret({
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv)).toBe("proffera-public-form-rate-limit-v1");
  });
});
