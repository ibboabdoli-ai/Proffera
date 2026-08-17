import { describe, expect, it } from "vitest";

import { buildPreviewSafeBrevoRequestInit } from "@/lib/preview-email-egress";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms";

describe("Preview Brevo egress safety", () => {
  it("does not change Production Brevo requests", () => {
    const init = {
      method: "POST",
      headers: { "api-key": "production-key" },
      body: JSON.stringify({ to: [{ email: "customer@example.com" }] }),
    } satisfies RequestInit;
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "production",
    };

    expect(buildPreviewSafeBrevoRequestInit(BREVO_URL, init, env)).toBe(init);
  });

  it("blocks Preview Brevo delivery when dedicated safe configuration is missing", () => {
    const init = {
      method: "POST",
      headers: { "api-key": "production-key" },
      body: JSON.stringify({ to: [{ email: "customer@example.com" }] }),
    } satisfies RequestInit;
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      BREVO_API_KEY: "production-key",
    };

    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_URL, init, env)).toThrow(/Preview email blocked/);
  });

  it("overrides the Brevo key and redirects every Preview recipient to the safe inbox", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      BREVO_API_KEY: "production-key",
      PROFFERA_PREVIEW_BREVO_API_KEY: "preview-key",
      PROFFERA_PREVIEW_EMAIL_RECIPIENT: "preview-inbox@example.com",
    };
    const result = buildPreviewSafeBrevoRequestInit(BREVO_URL, {
      method: "POST",
      headers: { "api-key": "production-key", "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [{ email: "real-customer@example.com", name: "Real Customer" }],
        cc: [{ email: "copy@example.com" }],
        bcc: [{ email: "hidden@example.com" }],
        subject: "Preview test",
      }),
    }, env);

    expect(result).toBeDefined();
    const headers = new Headers(result?.headers);
    expect(headers.get("api-key")).toBe("preview-key");

    const body = JSON.parse(String(result?.body)) as Record<string, unknown>;
    expect(body.to).toEqual([{ email: "preview-inbox@example.com", name: "Proffera Preview" }]);
    expect(body).not.toHaveProperty("cc");
    expect(body).not.toHaveProperty("bcc");
    expect(body.subject).toBe("Preview test");
  });

  it("blocks non-email Brevo endpoints in Preview, including SMS", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      PROFFERA_PREVIEW_BREVO_API_KEY: "preview-key",
      PROFFERA_PREVIEW_EMAIL_RECIPIENT: "preview-inbox@example.com",
    };

    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_SMS_URL, {
      method: "POST",
      body: JSON.stringify({ recipient: "+46700000000" }),
    }, env)).toThrow(/endpoint is not approved/);
  });

  it("does not touch unrelated Preview network requests", () => {
    const init = { method: "POST", body: "{}" } satisfies RequestInit;
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
    };

    expect(buildPreviewSafeBrevoRequestInit("https://example.com/api", init, env)).toBe(init);
  });
});
