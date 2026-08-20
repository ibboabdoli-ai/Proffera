import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStripeCheckoutPlanForPriceId: vi.fn(),
  getStripeClient: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
  isStripeEventModeAllowed: vi.fn(),
  syncWorkspaceSubscription: vi.fn(),
  applyServiceJobCheckoutCompleted: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeCheckoutPlanForPriceId: mocks.getStripeCheckoutPlanForPriceId,
  getStripeClient: mocks.getStripeClient,
  getStripeWebhookSecret: mocks.getStripeWebhookSecret,
}));
vi.mock("@/lib/stripe-runtime-config", () => ({
  isStripeEventModeAllowed: mocks.isStripeEventModeAllowed,
}));
vi.mock("@/lib/workspace-billing", () => ({
  syncWorkspaceSubscription: mocks.syncWorkspaceSubscription,
}));
vi.mock("@/lib/workspace-service-job-payments", () => ({
  applyServiceJobCheckoutCompleted: mocks.applyServiceJobCheckoutCompleted,
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("Stripe webhook environment safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStripeWebhookSecret.mockReturnValue("whsec_test");
  });

  it("rejects a signed event from the wrong Stripe mode before retrieving or syncing a subscription", async () => {
    const retrieve = vi.fn();
    mocks.getStripeClient.mockReturnValue({
      webhooks: {
        constructEventAsync: vi.fn().mockResolvedValue({
          type: "customer.subscription.updated",
          livemode: false,
          created: 123,
          data: { object: { id: "sub_test_wrong_mode" } },
        }),
      },
      subscriptions: { retrieve },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(false);

    const response = await POST(new Request("https://www.proffera.se/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid-signature" },
      body: "{}",
    }));

    expect(response.status).toBe(400);
    expect(mocks.isStripeEventModeAllowed).toHaveBeenCalledWith(false);
    expect(retrieve).not.toHaveBeenCalled();
    expect(mocks.syncWorkspaceSubscription).not.toHaveBeenCalled();
    expect(mocks.applyServiceJobCheckoutCompleted).not.toHaveBeenCalled();
  });

  it("keeps a same-mode subscription event on the normal billing sync path", async () => {
    const subscription = {
      id: "sub_live_ok",
      items: { data: [{ price: { id: "price_live_starter" } }] },
    };
    const retrieve = vi.fn().mockResolvedValue(subscription);
    mocks.getStripeClient.mockReturnValue({
      webhooks: {
        constructEventAsync: vi.fn().mockResolvedValue({
          type: "customer.subscription.updated",
          livemode: true,
          created: 456,
          data: { object: { id: "sub_live_ok" } },
        }),
      },
      subscriptions: { retrieve },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(true);
    mocks.getStripeCheckoutPlanForPriceId.mockReturnValue("starter");
    mocks.syncWorkspaceSubscription.mockResolvedValue({ ok: true });

    const response = await POST(new Request("https://www.proffera.se/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid-signature" },
      body: "{}",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.isStripeEventModeAllowed).toHaveBeenCalledWith(true);
    expect(retrieve).toHaveBeenCalledWith("sub_live_ok");
    expect(mocks.syncWorkspaceSubscription).toHaveBeenCalledWith(subscription, 456, "starter", "price_live_starter");
    expect(body).toEqual({ received: true, applied: true });
  });
});
