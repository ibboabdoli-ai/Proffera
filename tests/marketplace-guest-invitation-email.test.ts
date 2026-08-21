import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildMarketplaceGuestInvitationEmail,
  marketplaceGuestInvitationEmailConfigured,
  sendMarketplaceGuestInvitationEmail,
} from "@/features/email/marketplace-guest-invitation-email";

const originalApiKey = process.env.BREVO_API_KEY;
const originalFrom = process.env.LEAD_FROM_EMAIL;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalPreviewApiKey = process.env.PROFFERA_PREVIEW_BREVO_API_KEY;
const originalPreviewRecipient = process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT;
const originalFetch = globalThis.fetch;

function invitationInput() {
  return {
    recipientEmail: "offert@rorfirma.se",
    companyName: "Rör AB",
    quoteReferenceId: "PF-1234",
    category: "VVS",
    serviceType: "VVS / Rörmokare",
    city: "Södertälje",
    preferredDate: "2026-08-25",
    replyUrl: "https://www.proffera.se/offert/svara/token",
    optOutUrl: "https://www.proffera.se/offert/svara/token/avregistrera",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("marketplace guest invitation email delivery", () => {
  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.PROFFERA_PREVIEW_BREVO_API_KEY;
    delete process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT;
    process.env.BREVO_API_KEY = "test-api-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@proffera.se>";
  });

  afterEach(() => {
    restoreEnv("BREVO_API_KEY", originalApiKey);
    restoreEnv("LEAD_FROM_EMAIL", originalFrom);
    restoreEnv("VERCEL_ENV", originalVercelEnv);
    restoreEnv("PROFFERA_PREVIEW_BREVO_API_KEY", originalPreviewApiKey);
    restoreEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", originalPreviewRecipient);
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reports configuration readiness only when both Brevo settings exist", () => {
    expect(marketplaceGuestInvitationEmailConfigured()).toBe(true);

    delete process.env.BREVO_API_KEY;
    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);

    process.env.BREVO_API_KEY = "test-api-key";
    delete process.env.LEAD_FROM_EMAIL;
    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
  });

  it("sends the durable dispatch token as Brevo idempotencyKey", async () => {
    const idempotencyKey = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({ messageId: "provider-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await sendMarketplaceGuestInvitationEmail({
      ...invitationInput(),
      idempotencyKey,
    });

    expect(result).toEqual({ ok: true, providerMessageId: "provider-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body ?? "{}")) as { headers?: Record<string, string> };
    expect(body.headers?.idempotencyKey).toBe(idempotencyKey);
    expect(body.headers?.["Idempotency-Key"]).toBeUndefined();
  });

  it("fails closed in Preview when only the shared Production Brevo key is available", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT = "preview-controlled@example.com";

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
    await expect(sendMarketplaceGuestInvitationEmail(invitationInput())).resolves.toEqual({
      ok: false,
      code: "configuration",
      providerMessageId: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed in Preview when the dedicated Brevo key equals the shared key", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.PROFFERA_PREVIEW_BREVO_API_KEY = "test-api-key";
    process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT = "preview-controlled@example.com";

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
    await expect(sendMarketplaceGuestInvitationEmail(invitationInput())).resolves.toEqual({
      ok: false,
      code: "configuration",
      providerMessageId: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed in Preview when the controlled recipient is missing", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.PROFFERA_PREVIEW_BREVO_API_KEY = "preview-only-api-key";
    delete process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT;

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
    await expect(sendMarketplaceGuestInvitationEmail(invitationInput())).resolves.toEqual({
      ok: false,
      code: "configuration",
      providerMessageId: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the dedicated Preview Brevo key and rewrites the company recipient", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.PROFFERA_PREVIEW_BREVO_API_KEY = "preview-only-api-key";
    process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT = "preview-controlled@example.com";

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({ messageId: "preview-provider-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(true);
    await expect(sendMarketplaceGuestInvitationEmail(invitationInput())).resolves.toEqual({
      ok: true,
      providerMessageId: "preview-provider-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("api-key")).toBe("preview-only-api-key");
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      to?: Array<{ email?: string; name?: string }>;
    };
    expect(body.to).toEqual([
      { email: "preview-controlled@example.com", name: "Proffera Preview" },
    ]);
  });

  it("marks the controlled test email clearly and omits live quote and opt-out copy", () => {
    const email = buildMarketplaceGuestInvitationEmail({
      recipientEmail: "test@company.test",
      companyName: "Testmottagare",
      quoteReferenceId: "TEST-GUEST-QUOTE",
      category: "Test",
      serviceType: "Test",
      city: "Testmiljö",
      preferredDate: "",
      replyUrl: "https://www.proffera.se/offert/testa/token",
      optOutUrl: "https://www.proffera.se/avregistrera/test",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      testMode: true,
      language: "sv",
    });

    expect(email.subject).toContain("[TEST]");
    expect(email.text).toContain("Ingen kund, offertförfrågan, företagsprofil eller avregistrering påverkas.");
    expect(email.html).toContain("Proffera · TEST");
    expect(email.text).toContain("https://www.proffera.se/offert/testa/token");
    expect(email.html).toContain('href="https://www.proffera.se/offert/testa/token"');
    expect(email.text).not.toContain("Vill ni inte få fler");
    expect(email.text).not.toContain("https://www.proffera.se/avregistrera/test");
    expect(email.html).not.toContain("https://www.proffera.se/avregistrera/test");
  });

  it("renders the controlled test email in English when requested", () => {
    const email = buildMarketplaceGuestInvitationEmail({
      recipientEmail: "test@company.test",
      companyName: "Test recipient",
      quoteReferenceId: "TEST-GUEST-QUOTE",
      category: "Test",
      serviceType: "Test",
      city: "Test environment",
      preferredDate: "",
      replyUrl: "https://www.proffera.se/offert/testa/token?lang=en",
      optOutUrl: "https://www.proffera.se/avregistrera/test",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      testMode: true,
      language: "en",
    });

    expect(email.subject).toBe("[TEST] Proffera – Guest Quote invitation check");
    expect(email.text).toContain("No customer, quote request, business profile, or opt-out record is affected.");
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain("Open test link");
    expect(email.text).toContain("https://www.proffera.se/offert/testa/token?lang=en");
    expect(email.html).toContain('href="https://www.proffera.se/offert/testa/token?lang=en"');
  });
});
