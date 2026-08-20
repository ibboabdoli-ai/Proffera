import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  marketplaceGuestInvitationEmailConfigured,
  sendMarketplaceGuestInvitationEmail,
} from "@/features/email/marketplace-guest-invitation-email";

const originalApiKey = process.env.BREVO_API_KEY;
const originalFrom = process.env.LEAD_FROM_EMAIL;
const originalFetch = globalThis.fetch;

describe("marketplace guest invitation email delivery", () => {
  beforeEach(() => {
    process.env.BREVO_API_KEY = "test-api-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@proffera.se>";
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.LEAD_FROM_EMAIL;
    else process.env.LEAD_FROM_EMAIL = originalFrom;
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
      return new Response(JSON.stringify({ messageId: "provider-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await sendMarketplaceGuestInvitationEmail({
      recipientEmail: "offert@rorfirma.se",
      companyName: "Rör AB",
      quoteReferenceId: "PF-1234",
      category: "VVS",
      serviceType: "VVS / Rörmokare",
      city: "Södertälje",
      preferredDate: "2026-08-25",
      replyUrl: "https://www.proffera.se/offert/svara/token",
      optOutUrl: "https://www.proffera.se/offert/svara/token/avregistrera",
      idempotencyKey,
    });

    expect(result).toEqual({ ok: true, providerMessageId: "provider-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body ?? "{}")) as { headers?: Record<string, string> };
    expect(body.headers?.idempotencyKey).toBe(idempotencyKey);
    expect(body.headers?.["Idempotency-Key"]).toBeUndefined();
  });
});
