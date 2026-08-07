import { describe, expect, it } from "vitest";

import { resolveAuthSecret, resolveCustomerPortalSecret } from "../src/lib/auth-secret";

const testEnvironment = {
  NODE_ENV: "test",
} satisfies NodeJS.ProcessEnv;

describe("auth secret resolution", () => {
  it("uses the dedicated Preview secret in Vercel Preview", () => {
    expect(
      resolveAuthSecret({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        PROFFERA_PREVIEW_AUTH_SECRET: "preview-only-secret",
        BETTER_AUTH_SECRET: "production-secret",
      }),
    ).toBe("preview-only-secret");
  });

  it("never falls back to the Production auth secret in Preview", () => {
    expect(
      resolveAuthSecret({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        BETTER_AUTH_SECRET: "production-secret",
        AUTH_SECRET: "legacy-production-secret",
      }),
    ).toBeNull();
  });

  it("uses BETTER_AUTH_SECRET outside Preview", () => {
    expect(
      resolveAuthSecret({
        ...testEnvironment,
        VERCEL_ENV: "production",
        PROFFERA_PREVIEW_AUTH_SECRET: "preview-only-secret",
        BETTER_AUTH_SECRET: "production-secret",
      }),
    ).toBe("production-secret");
  });

  it("supports AUTH_SECRET outside Preview", () => {
    expect(
      resolveAuthSecret({
        ...testEnvironment,
        AUTH_SECRET: "legacy-production-secret",
      }),
    ).toBe("legacy-production-secret");
  });

  it("returns null when no supported auth secret exists", () => {
    expect(resolveAuthSecret(testEnvironment)).toBeNull();
  });

  it("uses only the dedicated Preview auth secret for customer portal tokens in Preview", () => {
    expect(
      resolveCustomerPortalSecret({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        PROFFERA_PREVIEW_AUTH_SECRET: "preview-only-secret",
        CUSTOMER_PORTAL_SECRET: "production-portal-secret",
        BETTER_AUTH_SECRET: "production-auth-secret",
      }),
    ).toBe("preview-only-secret");
  });

  it("does not reuse a Production customer portal secret when the Preview secret is missing", () => {
    expect(
      resolveCustomerPortalSecret({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        CUSTOMER_PORTAL_SECRET: "production-portal-secret",
        BETTER_AUTH_SECRET: "production-auth-secret",
      }),
    ).toBeNull();
  });

  it("keeps CUSTOMER_PORTAL_SECRET as the Production portal source of truth", () => {
    expect(
      resolveCustomerPortalSecret({
        ...testEnvironment,
        VERCEL_ENV: "production",
        CUSTOMER_PORTAL_SECRET: "production-portal-secret",
        BETTER_AUTH_SECRET: "production-auth-secret",
      }),
    ).toBe("production-portal-secret");
  });
});
