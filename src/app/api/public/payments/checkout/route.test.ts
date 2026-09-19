import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
  getPublicServiceJobPayment: vi.fn(),
  bindServiceJobCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: mocks.getStripeClient,
}));

vi.mock("@/lib/workspace-service-job-payments", () => ({
  getPublicServiceJobPayment: mocks.getPublicServiceJobPayment,
  bindServiceJobCheckoutSession: mocks.bindServiceJobCheckoutSession,
}));

import { POST } from "@/app/api/public/payments/checkout/route";

const payment = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  serviceJobId: "33333333-3333-4333-8333-333333333333",
  status: "pending",
  amountMinor: 12500,
  currency: "SEK",
  checkoutSessionId: "cs_existing",
  title: "Service job",
  companyName: "Example AB",
  stripeAccountId: "acct_123",
  accountReady: true,
};

function checkoutRequest(params: Record<string, string> = { token: "public-token", lang: "en" }) {
  return new Request("https://www.proffera.se/api/public/payments/checkout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
}

describe("public service-job checkout duplicate protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicServiceJobPayment.mockResolvedValue(payment);
    mocks.bindServiceJobCheckoutSession.mockResolvedValue(undefined);
  });

  it("fails closed when an existing Stripe Checkout session cannot be retrieved", async () => {
    const create = vi.fn();
    const retrieve = vi.fn().mockRejectedValue(new Error("stripe unavailable"));
    mocks.getStripeClient.mockReturnValue({ checkout: { sessions: { retrieve, create } } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(checkoutRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "checkout_state_unavailable" });
    expect(retrieve).toHaveBeenCalledWith("cs_existing");
    expect(create).not.toHaveBeenCalled();
    expect(mocks.bindServiceJobCheckoutSession).not.toHaveBeenCalled();
  });

  it("reuses an existing open Checkout session instead of creating another", async () => {
    const create = vi.fn();
    const retrieve = vi.fn().mockResolvedValue({
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_existing",
    });
    mocks.getStripeClient.mockReturnValue({ checkout: { sessions: { retrieve, create } } });

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/cs_existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("returns a completed session to the localized confirmation state without creating another", async () => {
    const create = vi.fn();
    const retrieve = vi.fn().mockResolvedValue({ status: "complete", url: null });
    mocks.getStripeClient.mockReturnValue({ checkout: { sessions: { retrieve, create } } });

    const response = await POST(checkoutRequest());
    const location = new URL(response.headers.get("location") ?? "https://invalid.local");

    expect(response.status).toBe(303);
    expect(location.pathname).toBe("/betala/public-token");
    expect(location.searchParams.get("lang")).toBe("en");
    expect(location.searchParams.get("status")).toBe("success");
    expect(create).not.toHaveBeenCalled();
  });

  it("fails closed if an open session unexpectedly has no redirect URL", async () => {
    const create = vi.fn();
    const retrieve = vi.fn().mockResolvedValue({ status: "open", url: null });
    mocks.getStripeClient.mockReturnValue({ checkout: { sessions: { retrieve, create } } });

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "checkout_unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a replacement only after expiry and uses a stable attempt idempotency key", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "cs_replacement",
      url: "https://checkout.stripe.com/c/pay/cs_replacement",
    });
    const retrieve = vi.fn().mockResolvedValue({ status: "expired", url: null });
    mocks.getStripeClient.mockReturnValue({ checkout: { sessions: { retrieve, create } } });

    const response = await POST(checkoutRequest({ token: "public-token", lang: "sv" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/cs_replacement");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        client_reference_id: payment.id,
        success_url: expect.stringContaining("status=success"),
      }),
      { idempotencyKey: `service-job-payment:${payment.id}:cs_existing` },
    );
    expect(mocks.bindServiceJobCheckoutSession).toHaveBeenCalledWith(payment.id, "cs_replacement");
  });
});
