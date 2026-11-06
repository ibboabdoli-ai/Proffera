import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  syncCancelledWorkspaceSubscription: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-billing", () => ({ syncCancelledWorkspaceSubscription: mocks.syncCancelledWorkspaceSubscription }));

import { applyFullSubscriptionRefund } from "@/lib/workspace-subscription-refund";

const WORKSPACE = "f0000000-0000-4000-8000-000000000045";
const CUSTOMER_ID = "cus_refund_test";
const PAYMENT_ID = "pi_refund_test";
const INVOICE_ID = "in_refund_test";
const SUBSCRIPTION_ID = "sub_refund_test";
const PRICE_ID = "price_refund_test";

function fixture() {
  const charge = {
    id: "ch_refund_test", amount: 29900, amount_refunded: 29900, refunded: true,
    currency: "sek", livemode: false, customer: CUSTOMER_ID, payment_intent: PAYMENT_ID,
  } as unknown as Stripe.Charge;
  const invoice = {
    id: INVOICE_ID, status: "paid", amount_paid: 29900, total: 29900, currency: "sek", customer: CUSTOMER_ID,
    parent: { type: "subscription_details", subscription_details: { subscription: SUBSCRIPTION_ID } },
  } as unknown as Stripe.Invoice;
  const subscription = {
    id: SUBSCRIPTION_ID, status: "active", customer: CUSTOMER_ID,
    latest_invoice: INVOICE_ID, metadata: { workspace_id: WORKSPACE },
    items: { data: [{ price: { id: PRICE_ID }, current_period_start: 1793800000, current_period_end: 1796392000 }] },
  } as unknown as Stripe.Subscription;
  const canceled = { ...subscription, status: "canceled" } as Stripe.Subscription;
  const stripe = {
    charges: { retrieve: vi.fn().mockResolvedValue(charge) },
    refunds: { list: vi.fn().mockResolvedValue({
      has_more: false, data: [{ status: "succeeded", amount: 29900 }],
    }) },
    invoicePayments: { list: vi.fn().mockImplementation(async (params: { invoice?: string }) =>
      params.invoice
        ? { has_more: false, data: [{
            invoice: INVOICE_ID, status: "paid", amount_paid: 29900,
            payment: { type: "payment_intent", payment_intent: PAYMENT_ID },
          }] }
        : { has_more: false, data: [{ invoice: INVOICE_ID, status: "paid" }] },
    ) },
    invoices: { retrieve: vi.fn().mockResolvedValue(invoice) },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue(subscription),
      cancel: vi.fn().mockResolvedValue(canceled),
    },
  } as unknown as Stripe;
  return { stripe, charge, invoice, subscription, canceled };
}

describe("full subscription refund entitlement reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSql.mockReturnValue(vi.fn().mockResolvedValue([{
      workspace_id: WORKSPACE, stripe_subscription_id: SUBSCRIPTION_ID,
      stripe_customer_id: CUSTOMER_ID, stripe_price_id: PRICE_ID,
    }]));
    mocks.syncCancelledWorkspaceSubscription.mockResolvedValue({ ok: true });
  });

  it("cancels only the verified current subscription and synchronizes the Workspace", async () => {
    const f = fixture();
    const result = await applyFullSubscriptionRefund(f.stripe, f.charge, 1793800000);
    expect(result).toEqual({ ok: true, applied: true });
    expect(f.stripe.invoicePayments.list).toHaveBeenCalledWith({
      payment: { type: "payment_intent", payment_intent: PAYMENT_ID }, limit: 2,
    });
    expect(f.stripe.subscriptions.cancel).toHaveBeenCalledWith(SUBSCRIPTION_ID, {
      invoice_now: false, prorate: false,
    });
    expect(mocks.syncCancelledWorkspaceSubscription).toHaveBeenCalledWith(
      f.canceled, 1793800000, PRICE_ID,
    );
  });

  it("ignores partial refunds without querying invoice data", async () => {
    const f = fixture();
    const result = await applyFullSubscriptionRefund(f.stripe, {
      ...f.charge, refunded: false, amount_refunded: 10000,
    }, 1);
    expect(result).toEqual({ ok: true, applied: false });
    expect(f.stripe.charges.retrieve).not.toHaveBeenCalled();
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("does not trust stale full-refund webhook state", async () => {
    const f = fixture();
    vi.mocked(f.stripe.charges.retrieve).mockResolvedValue({
      ...f.charge, refunded: false, amount_refunded: 10000,
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("does not cancel for pending or failed refunds even when a charge reports refunded", async () => {
    const f = fixture();
    vi.mocked(f.stripe.refunds.list).mockResolvedValue({
      has_more: false, data: [{ status: "pending", amount: 29900 }],
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("reads more than 100 refund records before summing succeeded amounts", async () => {
    const f = fixture();
    const first = Array.from({ length: 100 }, (_, i) =>
      ({ id: "re_" + String(i), status: "succeeded", amount: 200 }));
    vi.mocked(f.stripe.refunds.list)
      .mockResolvedValueOnce({ data: first, has_more: true } as never)
      .mockResolvedValueOnce({ data: [{ id: "re_last", status: "succeeded", amount: 9900 }], has_more: false } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: true });
    expect(f.stripe.refunds.list).toHaveBeenCalledWith({
      charge: f.charge.id, limit: 100, starting_after: "re_99",
    });
  });

  it("returns a retryable error for a repeated Stripe pagination cursor", async () => {
    const f = fixture();
    vi.mocked(f.stripe.refunds.list).mockResolvedValue({
      data: [{ id: "re_repeat", status: "succeeded", amount: 1 }], has_more: true,
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: false, code: "database" });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("rejects an invoice with a customer credit contributing to total paid value", async () => {
    const f = fixture();
    vi.mocked(f.stripe.invoices.retrieve).mockResolvedValue({
      ...f.invoice, amount_paid: 29900, total: 39900,
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("returns a retryable error when the matching Checkout binding has not arrived", async () => {
    const f = fixture();
    mocks.getSql.mockReturnValue(vi.fn().mockResolvedValue([{
      workspace_id: WORKSPACE, stripe_subscription_id: null,
    }]));
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: false, code: "binding_pending" });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("ignores an old subscription after a new one is linked to the same Workspace", async () => {
    const f = fixture();
    mocks.getSql.mockReturnValue(vi.fn().mockResolvedValue([{
      workspace_id: WORKSPACE, stripe_subscription_id: "sub_new",
      stripe_customer_id: "cus_new", stripe_price_id: PRICE_ID,
    }]));
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("fails closed on pending subscription upgrades", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.retrieve).mockResolvedValue({
      ...f.subscription, pending_update: { expires_at: 1793900000 },
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("uses cancellation time to avoid old refund-event ordering", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.cancel).mockResolvedValue({
      ...f.canceled, canceled_at: 1793900000,
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 15))
      .toEqual({ ok: true, applied: true });
    expect(mocks.syncCancelledWorkspaceSubscription).toHaveBeenCalledWith(
      expect.anything(), 1793900000, PRICE_ID,
    );
  });

  it("never cancels a one-off ServiceJob charge", async () => {
    const f = fixture();
    vi.mocked(f.stripe.invoicePayments.list).mockResolvedValue({
      data: [], has_more: false,
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("never cancels when the invoice was paid by two separate payments and only one is refunded", async () => {
    const f = fixture();
    const partlyRefunded = { ...f.charge, amount: 14900, amount_refunded: 14900 };
    vi.mocked(f.stripe.charges.retrieve).mockResolvedValue(partlyRefunded as never);
    vi.mocked(f.stripe.refunds.list).mockResolvedValue({
      has_more: false, data: [{ status: "succeeded", amount: 14900 }],
    } as never);
    vi.mocked(f.stripe.invoicePayments.list)
      .mockResolvedValueOnce({ has_more: false, data: [{ invoice: INVOICE_ID, status: "paid" }] } as never)
      .mockResolvedValueOnce({ has_more: false, data: [
        { invoice: INVOICE_ID, status: "paid", amount_paid: 14900,
          payment: { type: "payment_intent", payment_intent: PAYMENT_ID } },
        { invoice: INVOICE_ID, status: "paid", amount_paid: 15000,
          payment: { type: "payment_intent", payment_intent: "pi_other_paid" } },
      ] } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, partlyRefunded, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(mocks.syncCancelledWorkspaceSubscription).not.toHaveBeenCalled();
  });

  it("fails closed for multi-payment or out-of-band credit where invoice paid amount differs from refunded charge", async () => {
    const f = fixture();
    vi.mocked(f.stripe.invoices.retrieve).mockResolvedValue({
      ...f.invoice, amount_paid: 39900,
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("fails closed if all invoice payments could not be enumerated", async () => {
    const f = fixture();
    vi.mocked(f.stripe.invoicePayments.list)
      .mockResolvedValueOnce({ has_more: false, data: [{ invoice: INVOICE_ID, status: "paid" }] } as never)
      .mockResolvedValueOnce({ has_more: true, data: [{
        invoice: INVOICE_ID, status: "paid", amount_paid: 29900,
        payment: { type: "payment_intent", payment_intent: PAYMENT_ID },
      }] } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("blocks stale refunds when a new paid invoice appears during the Workspace DB lookup", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.retrieve)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce({ ...f.subscription, latest_invoice: "in_newer_paid" } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(mocks.syncCancelledWorkspaceSubscription).not.toHaveBeenCalled();
  });

  it("blocks refunds when a new subscription period appeared before cancellation", async () => {
    const f = fixture();
    const renewal = { ...f.subscription, items: { data: [{
      price: { id: PRICE_ID }, current_period_start: 1796392000, current_period_end: 1799070400,
    }] } };
    vi.mocked(f.stripe.subscriptions.retrieve)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce(renewal as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("blocks changed customer or Workspace binding at the final pre-cancel read", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.retrieve)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce({ ...f.subscription, metadata: { workspace_id: "f0000000-0000-4000-8000-000000000099" } } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("rejects a reused invoice ID with a different subscription price on second retrieval", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.retrieve)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce({ ...f.subscription, items: { data: [{
        price: { id: "price_new_upgrade" },
        current_period_start: 1793800000,
        current_period_end: 1796392000,
      }] } } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("does not cancel for older subscription invoices", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.retrieve).mockResolvedValue({
      ...f.subscription, latest_invoice: "in_newer_paid",
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("requires exact Workspace, subscription, customer and Price binding", async () => {
    const f = fixture();
    mocks.getSql.mockReturnValue(vi.fn().mockResolvedValue([]));
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("rejects inconsistent customer identifiers", async () => {
    const f = fixture();
    vi.mocked(f.stripe.invoices.retrieve).mockResolvedValue({
      ...f.invoice, customer: "cus_different",
    } as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: false });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("recovers simultaneous refunded-webhook cancellation races only after Stripe confirms cancellation", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.retrieve)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce(f.subscription as never)
      .mockResolvedValueOnce(f.canceled as never);
    vi.mocked(f.stripe.subscriptions.cancel)
      .mockResolvedValueOnce(f.canceled as never)
      .mockRejectedValueOnce({ code: "resource_missing" });

    const results = await Promise.all([
      applyFullSubscriptionRefund(f.stripe, f.charge, 123),
      applyFullSubscriptionRefund(f.stripe, f.charge, 123),
    ]);
    expect(results).toEqual([
      { ok: true, applied: true },
      { ok: true, applied: true },
    ]);
    expect(f.stripe.subscriptions.cancel).toHaveBeenCalledTimes(2);
    expect(mocks.syncCancelledWorkspaceSubscription).toHaveBeenCalledTimes(2);
  });

  it("fails closed if resource_missing was not caused by a confirmed cancellation", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.cancel).mockRejectedValue({ code: "resource_missing" });
    await expect(applyFullSubscriptionRefund(f.stripe, f.charge, 123))
      .rejects.toMatchObject({ code: "resource_missing" });
    expect(mocks.syncCancelledWorkspaceSubscription).not.toHaveBeenCalled();
  });

  it("reconciles already canceled subscriptions without repeating Stripe cancellation", async () => {
    const f = fixture();
    vi.mocked(f.stripe.subscriptions.retrieve).mockResolvedValue(f.canceled as never);
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: true });
    expect(f.stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(mocks.syncCancelledWorkspaceSubscription).toHaveBeenCalledWith(f.canceled, 1, PRICE_ID);
  });

  it("returns a retryable failure if local billing persistence fails", async () => {
    const f = fixture();
    mocks.syncCancelledWorkspaceSubscription.mockResolvedValue({ ok: false, code: "database" });
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: false, code: "database" });
  });

  it("accepts a historical Stripe Price when the persisted subscription binding matches", async () => {
    const f = fixture();
    const priceId = "price_retired_starter";
    const oldPrice = { ...f.subscription, items: { data: [{
      ...f.subscription.items.data[0], price: { id: priceId },
    }] } } as never;
    vi.mocked(f.stripe.subscriptions.retrieve).mockResolvedValue(oldPrice);
    mocks.getSql.mockReturnValue(vi.fn().mockResolvedValue([{
      stripe_subscription_id: SUBSCRIPTION_ID,
      stripe_customer_id: CUSTOMER_ID, stripe_price_id: priceId,
    }]));
    expect(await applyFullSubscriptionRefund(f.stripe, f.charge, 1))
      .toEqual({ ok: true, applied: true });
    expect(mocks.syncCancelledWorkspaceSubscription).toHaveBeenCalledWith(
      f.canceled, 1, priceId,
    );
  });
});
