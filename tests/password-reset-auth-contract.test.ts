import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn(),
  after: vi.fn(),
  resolvePreviewAuthOriginConfig: vi.fn(),
  resolveAuthSecret: vi.fn(),
  resolveDatabaseUrl: vi.fn(),
  resetLocale: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("better-auth", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("pg", () => ({
  Pool: class FakePool {
    constructor(public options: unknown) {}
  },
}));
vi.mock("@/lib/auth-origin", () => ({
  resolvePreviewAuthOriginConfig: mocks.resolvePreviewAuthOriginConfig,
}));
vi.mock("@/lib/auth-secret", () => ({ resolveAuthSecret: mocks.resolveAuthSecret }));
vi.mock("@/lib/db/database-url", () => ({ resolveNodePostgresDatabaseUrl: mocks.resolveDatabaseUrl }));
vi.mock("@/features/email/password-reset-email", () => ({
  passwordResetLocaleFromGeneratedUrl: mocks.resetLocale,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

import {
  getAuth,
  PASSWORD_RESET_REQUEST_RATE_LIMIT,
  PASSWORD_RESET_SUBMIT_RATE_LIMIT,
  PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS,
} from "@/lib/auth";

describe("Better Auth password reset contract", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.resolveDatabaseUrl.mockReturnValue("postgres://user:pass@localhost:5432/proffera");
    mocks.resolveAuthSecret.mockReturnValue("test-secret-that-is-long-enough-for-auth");
    mocks.resolvePreviewAuthOriginConfig.mockReturnValue(null);
    mocks.betterAuth.mockImplementation((config) => ({ config }));
    mocks.resetLocale.mockReturnValue("en");
    mocks.sendPasswordResetEmail.mockResolvedValue({ ok: true, providerMessageId: "message-1" });
  });

  it("uses the built-in reset flow with bounded tokens, session revocation, endpoint rate limits and deferred email", async () => {
    getAuth();

    expect(PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS).toBe(3600);
    expect(PASSWORD_RESET_REQUEST_RATE_LIMIT).toEqual({ window: 900, max: 5 });
    expect(PASSWORD_RESET_SUBMIT_RATE_LIMIT).toEqual({ window: 900, max: 10 });
    expect(mocks.betterAuth).toHaveBeenCalledTimes(1);

    const config = mocks.betterAuth.mock.calls[0]?.[0] as {
      emailAndPassword: {
        enabled: boolean;
        minPasswordLength: number;
        maxPasswordLength: number;
        resetPasswordTokenExpiresIn: number;
        revokeSessionsOnPasswordReset: boolean;
        sendResetPassword: (input: { user: { email: string }; url: string; token: string }) => Promise<void>;
      };
      rateLimit: { customRules: Record<string, { window: number; max: number }> };
    };

    expect(config.emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
    });
    expect(config.rateLimit.customRules).toEqual({
      "/request-password-reset": { window: 900, max: 5 },
      "/reset-password": { window: 900, max: 10 },
    });

    const generatedUrl = "https://www.proffera.se/api/auth/reset-password/opaque-token?callbackURL=%2Faterstall-losenord%3Flang%3Den";
    const token = "ABCDEFGHIJKLMNOPQRSTUVWX";
    await config.emailAndPassword.sendResetPassword({
      user: { email: "owner@example.com" },
      url: generatedUrl,
      token,
    });

    expect(mocks.resetLocale).toHaveBeenCalledWith(generatedUrl);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();

    const deferred = mocks.after.mock.calls[0]?.[0] as () => Promise<void>;
    await deferred();
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith({
      recipientEmail: "owner@example.com",
      token,
      locale: "en",
    });
  });
});
