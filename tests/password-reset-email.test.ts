import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveBrevoApiKey: vi.fn(),
  resolveEmailRecipient: vi.fn(),
  resolvePublicBaseUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email-runtime-config", () => ({
  resolveBrevoApiKey: mocks.resolveBrevoApiKey,
  resolveEmailRecipient: mocks.resolveEmailRecipient,
}));
vi.mock("@/lib/marketplace-public-base-url", () => ({
  resolveMarketplacePublicBaseUrl: mocks.resolvePublicBaseUrl,
}));

import {
  buildPasswordResetBrowserUrl,
  passwordResetLocaleFromGeneratedUrl,
  sendPasswordResetEmail,
} from "@/features/email/password-reset-email";

describe("password reset email safety", () => {
  const token = "ABCDEFGHIJKLMNOPQRSTUVWX";
  const originalFetch = globalThis.fetch;
  const originalFrom = process.env.LEAD_FROM_EMAIL;

  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.resolvePublicBaseUrl.mockReturnValue("https://preview-proffera.example");
    mocks.resolveBrevoApiKey.mockReturnValue("preview-key");
    mocks.resolveEmailRecipient.mockReturnValue({
      email: "safe-preview@example.com",
      name: "Proffera Preview",
    });
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@proffera.se>";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalFrom === undefined) delete process.env.LEAD_FROM_EMAIL;
    else process.env.LEAD_FROM_EMAIL = originalFrom;
    vi.restoreAllMocks();
  });

  it("keeps the reset token out of the HTTP request path and query by using a fragment", () => {
    const resetUrl = new URL(buildPasswordResetBrowserUrl(token, "en"));

    expect(resetUrl.origin).toBe("https://preview-proffera.example");
    expect(resetUrl.pathname).toBe("/aterstall-losenord");
    expect(resetUrl.searchParams.get("lang")).toBe("en");
    expect(resetUrl.pathname).not.toContain(token);
    expect(resetUrl.search).not.toContain(token);
    expect(resetUrl.hash).toBe(`#token=${token}`);
  });

  it("derives email language only from the trusted Better Auth callback target", () => {
    expect(passwordResetLocaleFromGeneratedUrl(
      "https://www.proffera.se/api/auth/reset-password/server-token?callbackURL=%2Faterstall-losenord%3Flang%3Den",
    )).toBe("en");
    expect(passwordResetLocaleFromGeneratedUrl(
      "https://www.proffera.se/api/auth/reset-password/server-token?callbackURL=%2Faterstall-losenord",
    )).toBe("sv");
    expect(passwordResetLocaleFromGeneratedUrl("not-a-url")).toBe("sv");
  });

  it("uses the runtime-safe recipient boundary and never sends to the submitted address in Preview", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ messageId: "message-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(sendPasswordResetEmail({
      recipientEmail: "real-user@example.com",
      token,
      locale: "sv",
    })).resolves.toEqual({ ok: true, providerMessageId: "message-1" });

    expect(mocks.resolveEmailRecipient).toHaveBeenCalledWith({ email: "real-user@example.com" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toBeDefined();
    const body = JSON.parse(String(init?.body)) as {
      to: Array<{ email: string }>;
      textContent: string;
      htmlContent: string;
      tags: string[];
    };
    expect(body.to).toEqual([{ email: "safe-preview@example.com", name: "Proffera Preview" }]);
    expect(body.tags).toEqual(["password-reset"]);
    expect(body.textContent).toContain("#token=");
    expect(body.htmlContent).toContain("#token=");
    expect(JSON.stringify(body)).not.toContain("real-user@example.com");
  });

  it("fails closed when email runtime configuration is unavailable", async () => {
    mocks.resolveBrevoApiKey.mockReturnValue(null);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendPasswordResetEmail({
      recipientEmail: "owner@example.com",
      token,
      locale: "en",
    })).resolves.toEqual({ ok: false, code: "configuration", providerMessageId: null });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("owner@example.com");
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(token);
  });

  it("does not leak the recipient or reset token into provider-error logs", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ code: "invalid_parameter" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await sendPasswordResetEmail({
      recipientEmail: "owner@example.com",
      token,
      locale: "en",
    });

    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("owner@example.com");
    expect(logged).not.toContain(token);
  });
});
