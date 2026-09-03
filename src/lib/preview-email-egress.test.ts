import { afterEach, describe, expect, it, vi } from "vitest";

import { register } from "@/instrumentation";
import { buildPreviewSafeBrevoRequestInit } from "@/lib/preview-email-egress";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms";
const BREVO_LIST_URL = "https://api.brevo.com/v3/smtp/emails?email=preview-inbox%40example.com&startDate=2026-09-03&endDate=2026-09-03&sort=desc";
const BREVO_DETAIL_URL = "https://api.brevo.com/v3/smtp/emails/123e4567-e89b-12d3-a456-426614174000";
const MARKETPLACE_E2E_BRANCH = "work/proffera-marketplace-browser-lifecycle-e2e";

const originalVercelEnv = process.env.VERCEL_ENV;
const originalVercelGitCommitRef = process.env.VERCEL_GIT_COMMIT_REF;
const originalBrevoApiKey = process.env.BREVO_API_KEY;
const originalPreviewBrevoApiKey = process.env.PROFFERA_PREVIEW_BREVO_API_KEY;
const originalPreviewEmailRecipient = process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT;

function previewEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "work/proffera-preview-unrelated",
    BREVO_API_KEY: "production-key",
    PROFFERA_PREVIEW_BREVO_API_KEY: "preview-key",
    PROFFERA_PREVIEW_EMAIL_RECIPIENT: "preview-inbox@example.com",
    ...overrides,
  };
}

afterEach(() => {
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;

  if (originalVercelGitCommitRef === undefined) delete process.env.VERCEL_GIT_COMMIT_REF;
  else process.env.VERCEL_GIT_COMMIT_REF = originalVercelGitCommitRef;

  if (originalBrevoApiKey === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = originalBrevoApiKey;

  if (originalPreviewBrevoApiKey === undefined) delete process.env.PROFFERA_PREVIEW_BREVO_API_KEY;
  else process.env.PROFFERA_PREVIEW_BREVO_API_KEY = originalPreviewBrevoApiKey;

  if (originalPreviewEmailRecipient === undefined) delete process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT;
  else process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT = originalPreviewEmailRecipient;

  vi.unstubAllGlobals();
});

describe("Preview Brevo egress safety", () => {
  it("keeps Production Brevo behavior unchanged", () => {
    const init = {
      method: "DELETE",
      headers: { "api-key": "production-key" },
    } satisfies RequestInit;
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "production",
    };

    expect(buildPreviewSafeBrevoRequestInit(BREVO_DETAIL_URL, init, env)).toBe(init);
  });

  it("normal Preview permits transactional POST only and keeps recipient rewriting fail-closed", () => {
    const env = previewEnv();
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
    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_URL, { method: "GET" }, env)).toThrow(/method is not approved/);
    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_SMS_URL, { method: "POST", body: "{}" }, env)).toThrow(/endpoint is not approved/);
  });

  it("unrelated Preview branches cannot use Brevo read endpoints", () => {
    const env = previewEnv({ VERCEL_GIT_COMMIT_REF: "work/proffera-preview-other" });
    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_LIST_URL, { method: "GET" }, env)).toThrow(/limited to Marketplace E2E Preview/);
    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_DETAIL_URL, { method: "GET" }, env)).toThrow(/limited to Marketplace E2E Preview/);
  });

  it("exact Marketplace E2E Preview can GET the strictly-scoped Brevo list endpoint", () => {
    const env = previewEnv({ VERCEL_GIT_COMMIT_REF: MARKETPLACE_E2E_BRANCH });
    const result = buildPreviewSafeBrevoRequestInit(BREVO_LIST_URL, {
      method: "GET",
      headers: { "api-key": "wrong-key" },
    }, env);
    const headers = new Headers(result?.headers);
    expect(result?.method).toBe("GET");
    expect(headers.get("api-key")).toBe("preview-key");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("exact Marketplace E2E Preview can GET one validated Brevo email detail endpoint", () => {
    const env = previewEnv({ VERCEL_GIT_COMMIT_REF: MARKETPLACE_E2E_BRANCH });
    const result = buildPreviewSafeBrevoRequestInit(BREVO_DETAIL_URL, { method: "GET" }, env);
    expect(result?.method).toBe("GET");
    expect(new Headers(result?.headers).get("api-key")).toBe("preview-key");
  });

  it("rejects POST, DELETE and other methods to the Preview reader endpoints", () => {
    const env = previewEnv({ VERCEL_GIT_COMMIT_REF: MARKETPLACE_E2E_BRANCH });
    for (const method of ["POST", "DELETE", "PUT", "PATCH", "HEAD"]) {
      expect(() => buildPreviewSafeBrevoRequestInit(BREVO_LIST_URL, { method }, env), method).toThrow(/method is not approved/);
      expect(() => buildPreviewSafeBrevoRequestInit(BREVO_DETAIL_URL, { method }, env), method).toThrow(/method is not approved/);
    }
  });

  it("rejects arbitrary Brevo paths and non-allowlisted list query parameters", () => {
    const env = previewEnv({ VERCEL_GIT_COMMIT_REF: MARKETPLACE_E2E_BRANCH });
    expect(() => buildPreviewSafeBrevoRequestInit("https://api.brevo.com/v3/account", { method: "GET" }, env)).toThrow(/endpoint is not approved/);
    expect(() => buildPreviewSafeBrevoRequestInit(`${BREVO_LIST_URL}&limit=100`, { method: "GET" }, env)).toThrow(/endpoint is not approved/);
    expect(() => buildPreviewSafeBrevoRequestInit("https://api.brevo.com/v3/smtp/emails/123e4567-e89b-12d3-a456-426614174000?extra=1", { method: "GET" }, env)).toThrow(/endpoint is not approved/);
    expect(() => buildPreviewSafeBrevoRequestInit("https://api.brevo.com/v3/smtp/emails/not%2Fa-valid-uuid", { method: "GET" }, env)).toThrow(/endpoint is not approved/);
  });

  it("enforces Preview key separation for both transactional sends and E2E reads", () => {
    const env = previewEnv({
      VERCEL_GIT_COMMIT_REF: MARKETPLACE_E2E_BRANCH,
      BREVO_API_KEY: "same-key",
      PROFFERA_PREVIEW_BREVO_API_KEY: "same-key",
    });
    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_URL, {
      method: "POST",
      body: JSON.stringify({ to: [{ email: "customer@example.com" }] }),
    }, env)).toThrow(/dedicated Brevo key/);
    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_LIST_URL, { method: "GET" }, env)).toThrow(/dedicated Brevo key/);
  });

  it("blocks Preview Brevo delivery when dedicated safe configuration is missing", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      BREVO_API_KEY: "production-key",
    };

    expect(() => buildPreviewSafeBrevoRequestInit(BREVO_URL, {
      method: "POST",
      body: JSON.stringify({ to: [{ email: "customer@example.com" }] }),
    }, env)).toThrow(/Preview email blocked/);
  });

  it("keeps the shared key untouched while instrumentation enforces the dedicated Preview credential", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = "work/proffera-preview-unrelated";
    process.env.BREVO_API_KEY = "production-key";
    process.env.PROFFERA_PREVIEW_BREVO_API_KEY = "preview-key";
    process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT = "preview-inbox@example.com";

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await register();
    expect(process.env.BREVO_API_KEY).toBe("production-key");

    await globalThis.fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": "production-key", "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [{ email: "real-customer@example.com" }],
        cc: [{ email: "copy@example.com" }],
        bcc: [{ email: "hidden@example.com" }],
        subject: "Instrumentation preview test",
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, forwardedInit] = fetchMock.mock.calls[0];
    const headers = new Headers(forwardedInit?.headers);
    expect(headers.get("api-key")).toBe("preview-key");
    const body = JSON.parse(String(forwardedInit?.body)) as Record<string, unknown>;
    expect(body.to).toEqual([{ email: "preview-inbox@example.com", name: "Proffera Preview" }]);
    expect(body).not.toHaveProperty("cc");
    expect(body).not.toHaveProperty("bcc");
  });

  it("does not touch unrelated Preview network requests", () => {
    const init = { method: "POST", body: "{}" } satisfies RequestInit;
    expect(buildPreviewSafeBrevoRequestInit("https://example.com/api", init, previewEnv())).toBe(init);
  });
});
