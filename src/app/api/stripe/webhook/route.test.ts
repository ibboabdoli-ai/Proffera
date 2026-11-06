import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStripeCheckoutPlanForPriceId: vi.fn(),
  getStripeClient: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
  isStripeEventModeAllowed: vi.fn(),
  syncWorkspaceSubscription: vi.fn(),
  syncCancelledWorkspaceSubscription: vi.fn(),
  applyServiceJobCheckoutCompleted: vi.fn(),
  applyFullSubscriptionRefund: vi.fn(),
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
  syncCancelledWorkspaceSubscription: mocks.syncCancelledWorkspaceSubscription,
}));
vi.mock("@/lib/workspace-service-job-payments", () => ({
  applyServiceJobCheckoutCompleted: mocks.applyServiceJobCheckoutCompleted,
}));
vi.mock("@/lib/workspace-subscription-refund", () => ({
  applyFullSubscriptionRefund: mocks.applyFullSubscriptionRefund,
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

  it("routes a valid same-mode fully refunded charge to the guarded entitlement handler", async () => {
    const charge = { id: "ch_test_refund", amount: 29900, amount_refunded: 29900, refunded: true };
    mocks.getStripeClient.mockReturnValue({ webhooks: {
      constructEventAsync: vi.fn().mockResolvedValue({
        type: "charge.refunded", livemode: false, created: 1000, data: { object: charge },
      }),
    } });
    mocks.isStripeEventModeAllowed.mockReturnValue(true);
    mocks.applyFullSubscriptionRefund.mockResolvedValue({ ok: true, applied: true });
    const response = await POST(new Request("https://preview.proffera.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "signed-payload" }, body: '{"signed":true}',
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, applied: true });
    expect(mocks.applyFullSubscriptionRefund).toHaveBeenCalledWith(expect.anything(), charge, 1000);
  });

  it("does not act on pending refund.created events", async () => {
    const retrieve = vi.fn();
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEventAsync: vi.fn().mockResolvedValue({
        type: "refund.created", livemode: false, created: 999,
        data: { object: { id: "re_pending", status: "pending", charge: "ch_pending" } },
      }) }, charges: { retrieve },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(true);
    const response = await POST(new Request("https://preview.proffera.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "signed" }, body: "{}",
    }));
    expect(response.status).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
    expect(mocks.applyFullSubscriptionRefund).not.toHaveBeenCalled();
  });

  it("handles a completed refund.updated through the guarded path", async () => {
    const charge = { id: "ch_refund_succeeded" };
    const retrieve = vi.fn().mockResolvedValue(charge);
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEventAsync: vi.fn().mockResolvedValue({
        type: "refund.updated", livemode: false, created: 1111,
        data: { object: { id: "re_success", status: "succeeded", charge: "ch_refund_succeeded" } },
      }) }, charges: { retrieve },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(true);
    mocks.applyFullSubscriptionRefund.mockResolvedValue({ ok: true, applied: true });
    const response = await POST(new Request("https://preview.proffera.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "signed" }, body: "{}",
    }));
    expect(response.status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("ch_refund_succeeded");
    expect(mocks.applyFullSubscriptionRefund).toHaveBeenCalledWith(expect.anything(), charge, 1111);
  });

  it("rejects an invalid event mode before applying any refund", async () => {
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEventAsync: vi.fn().mockResolvedValue({
        type: "charge.refunded", livemode: true, data: { object: { id: "ch_wrong_mode" } },
      }) },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(false);
    const response = await POST(new Request("https://preview.proffera.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "signed" }, body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(mocks.applyFullSubscriptionRefund).not.toHaveBeenCalled();
  });

  it("returns retryable failure when a verified refund cannot persist access", async () => {
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEventAsync: vi.fn().mockResolvedValue({
        type: "charge.refunded", livemode: false, created: 1000,
        data: { object: { id: "ch_refund_database_error" } },
      }) },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(true);
    mocks.applyFullSubscriptionRefund.mockResolvedValue({ ok: false, code: "database" });
    const response = await POST(new Request("https://preview.proffera.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "signed" }, body: "{}",
    }));
    expect(response.status).toBe(500);
  });
  it("retries a signed cancellation webhook when Checkout verification fails", async () => {
    const subscription = {
      id: "sub_initial_pending", status: "canceled",
      customer: "cus_initial",
      metadata: { workspace_id: "f0000000-0000-4000-8000-000000000045" },
      items: { data: [{ price: { id: "price_starter" } }] },
    };
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEventAsync: vi.fn().mockResolvedValue({
        type: "customer.subscription.deleted", livemode: false, created: 1793900000,
        data: { object: subscription },
      }) },
      subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription) },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(true);
    mocks.syncCancelledWorkspaceSubscription.mockResolvedValue({ ok: false, code: "database" });
    const response = await POST(new Request("https://preview.proffera.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "signed" }, body: "{}",
    }));
    expect(response.status).toBe(500);
    expect(mocks.syncCancelledWorkspaceSubscription).toHaveBeenCalledWith(
      subscription, 1793900000, "price_starter", expect.anything(),
    );
  });

  it("revokes a canceled historical-Price subscription through guarded binding without current Price mapping", async () => {
    const subscription = {
      id: "sub_retired",
      status: "canceled",
      customer: "cus_old",
      metadata: { workspace_id: "f0000000-0000-4000-8000-000000000045" },
      items: { data: [{ price: { id: "price_retired" } }] },
    };
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEventAsync: vi.fn().mockResolvedValue({
        type: "customer.subscription.deleted", livemode: false, created: 1793900000,
        data: { object: subscription },
      }) },
      subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription) },
    });
    mocks.isStripeEventModeAllowed.mockReturnValue(true);
    mocks.getStripeCheckoutPlanForPriceId.mockReturnValue(null);
    mocks.syncCancelledWorkspaceSubscription.mockResolvedValue({ ok: true });
    const response = await POST(new Request("https://preview.proffera.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "signed" }, body: "{}",
    }));
    expect(response.status).toBe(200);
    expect(mocks.syncCancelledWorkspaceSubscription).toHaveBeenCalledWith(
      subscription, 1793900000, "price_retired", expect.anything(),
    );
    expect(mocks.syncWorkspaceSubscription).not.toHaveBeenCalled();
  });

});
