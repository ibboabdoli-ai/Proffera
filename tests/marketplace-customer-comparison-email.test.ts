import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveBrevoApiKey: vi.fn(),
  resolveEmailRecipient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email-runtime-config", () => ({
  resolveBrevoApiKey: mocks.resolveBrevoApiKey,
  resolveEmailRecipient: mocks.resolveEmailRecipient,
}));

import { sendMarketplaceCustomerComparisonEmail } from "@/features/email/marketplace-customer-comparison-email";

const originalLeadFrom = process.env.LEAD_FROM_EMAIL;

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.resolveBrevoApiKey.mockReturnValue("test-api-key");
  mocks.resolveEmailRecipient.mockReturnValue({ email: "anna@example.se", name: "Anna" });
  process.env.LEAD_FROM_EMAIL = "Proffera <hello@proffera.se>";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalLeadFrom === undefined) delete process.env.LEAD_FROM_EMAIL;
  else process.env.LEAD_FROM_EMAIL = originalLeadFrom;
});

describe("marketplace customer comparison email", () => {
  it("sends Brevo idempotency through the transactional payload headers map", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "brevo-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMarketplaceCustomerComparisonEmail({
      recipientEmail: "anna@example.se",
      customerName: "Anna",
      quoteReferenceId: "PRO-123",
      comparisonUrl: "https://www.proffera.se/offert/jamfor/token",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({ ok: true, providerMessageId: "brevo-1" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const httpHeaders = init.headers as Record<string, string>;
    expect(httpHeaders).not.toHaveProperty("idempotencyKey");
    expect(httpHeaders).not.toHaveProperty("Idempotency-Key");
    const body = JSON.parse(String(init.body)) as { headers?: Record<string, string> };
    expect(body.headers).toEqual({ idempotencyKey: "11111111-1111-4111-8111-111111111111" });
  });

  it("surfaces Brevo duplicate idempotency responses separately", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "duplicate_parameter",
      message: "duplicate idempotency key",
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })));

    const result = await sendMarketplaceCustomerComparisonEmail({
      recipientEmail: "anna@example.se",
      customerName: "Anna",
      quoteReferenceId: "PRO-123",
      comparisonUrl: "https://www.proffera.se/offert/jamfor/token",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({
      ok: false,
      code: "duplicate",
      providerMessageId: null,
      message: "duplicate idempotency key",
    });
  });
});
