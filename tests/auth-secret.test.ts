import { describe, expect, it } from "vitest";

import { resolveAuthSecret } from "../src/lib/auth-secret";

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
});
