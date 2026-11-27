import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  sql: vi.fn(),
  syncWorkspaceAiChat: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/service-ai-chat-bridge", () => ({
  syncWorkspaceAiChat: mocks.syncWorkspaceAiChat,
}));

import {
  syncCancelledWorkspaceSubscription,
  syncWorkspaceSubscription,
} from "@/lib/workspace-billing";

const ws = "f0000000-0000-4000-8000-000000000045";
const sub = {
  id: "sub_test",
  status: "canceled",
  livemode: false,
  customer: "cus_test",
  metadata: { workspace_id: ws },
  items: { data: [{
    price: { id: "price_old" },
    current_period_start: 1793800000,
    current_period_end: 1796392000,
  }] },
  canceled_at: 1793890000,
} as unknown as Stripe.Subscription;

describe("atomic refund cancellation projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sql.mockResolvedValue([{
      billing_count: 1, plan_count: 1, flag_count: 4,
    }]);
    mocks.getSql.mockReturnValue(mocks.sql);
    mocks.syncWorkspaceAiChat.mockResolvedValue({ ok: true });
  });

  it("changes plan and flags only after updating the matching billing row", async () => {
    expect(await syncCancelledWorkspaceSubscription(sub, 1793890000, "price_old"))
      .toEqual({ ok: true });
    const [strings, ...parameters] = mocks.sql.mock.calls[0];
    const query = strings.join("?").toLowerCase();
    expect(query).toContain("update workspace_billing_subscriptions");
    expect(query).toContain("b.stripe_subscription_id =");
    expect(query).toContain("b.stripe_customer_id =");
    expect(query).toContain("stripe_price_id =");
    expect(query).not.toContain("and b.stripe_price_id =");
    expect(parameters).toContain("price_old");
    expect(query).toContain("from changed_billing b");
    expect(query).toContain("greatest(coalesce(b.last_event_created, 0)");
    expect(parameters).toContain("sub_test");
    expect(parameters).toContain("cus_test");
    expect(mocks.syncWorkspaceAiChat).toHaveBeenCalledWith({
      workspaceId: ws, enabled: false,
    });
  });

  it("revokes Maria canonical booking access atomically without changing other workspaces", async () => {
    mocks.sql.mockResolvedValueOnce([{
      billing_count: 1, plan_count: 1, flag_count: 5, maria_flag_count: 1,
    }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793890000, "price_old"))
      .toEqual({ ok: true });
    const [sql] = mocks.sql.mock.calls[0];
    const mutation = sql.join("?").toLowerCase();
    expect(mutation).toContain("'online_booking'");
    expect(mutation).toContain("w.slug='makeup-by-maria'");
    expect(mutation).toContain("changed_billing");
  });

  it("synchronizes Maria-only booking feature on Stripe active webhook", async () => {
    mocks.sql.mockResolvedValueOnce([{ workspace_id: ws }]);
    const active = { ...sub, status: "active" } as Stripe.Subscription;
    expect(await syncWorkspaceSubscription(active, 1793890000, "starter", "price_old"))
      .toEqual({ ok: true });
    const [sql, ...params] = mocks.sql.mock.calls[0];
    const mutation = sql.join("?").toLowerCase();
    expect(mutation).toContain("'online_booking'");
    expect(mutation).toContain("fv.feature_key <> 'online_booking'");
    expect(mutation).toContain("w.slug='makeup-by-maria'");
    expect(params).toContain(true);
  });

  it("reconciles cancellation after same-subscription Price upgrade was not persisted", async () => {
    const newestPrice = "price_upgraded_not_yet_synced";
    const newer = { ...sub, items: { data: [{
      ...sub.items.data[0], price: { id: newestPrice },
    }] } } as Stripe.Subscription;
    expect(await syncCancelledWorkspaceSubscription(newer, 1793900000, newestPrice))
      .toEqual({ ok: true });
    const [fragments, ...parameters] = mocks.sql.mock.calls[0];
    const query = fragments.join("?").toLowerCase();
    expect(query).toContain("stripe_price_id =");
    expect(query).not.toContain("and b.stripe_price_id =");
    expect(parameters).toContain("sub_test");
    expect(parameters).toContain("cus_test");
    expect(parameters).toContain(newestPrice);
  });

  const checkoutProof = {
    id: "cs_test_checkout_proven",
    status: "complete",
    mode: "subscription",
    livemode: false,
    subscription: sub.id,
    customer: "cus_test",
    client_reference_id: ws,
    metadata: { workspace_id: ws },
  };

  it("repairs a completed Checkout canceled before its subscription webhook was stored", async () => {
    const retrieve = vi.fn().mockResolvedValue(checkoutProof);
    const stripe = { checkout: { sessions: { retrieve } } } as unknown as Stripe;
    mocks.sql
      .mockResolvedValueOnce([{ stripe_checkout_session_id: checkoutProof.id }])
      .mockResolvedValueOnce([{ billing_count: 1, plan_count: 1, flag_count: 4 }]);

    expect(await syncCancelledWorkspaceSubscription(sub, 1793900000, "price_old", stripe))
      .toEqual({ ok: true });
    expect(retrieve).toHaveBeenCalledExactlyOnceWith(checkoutProof.id);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    const [preflight, ...preflightParams] = mocks.sql.mock.calls[0];
    const [update, ...updateParams] = mocks.sql.mock.calls[1];
    const lookup = preflight.join("?").toLowerCase();
    const mutation = update.join("?").toLowerCase();
    expect(lookup).toContain("stripe_subscription_id is null");
    expect(lookup).toContain("status = 'pending'");
    expect(mutation).toContain("with latest_plan as");
    expect(mutation).toContain("workspace_plan_id = coalesce(b.workspace_plan_id");
    expect(mutation).toContain("b.workspace_plan_id is not null or exists (select 1 from latest_plan)");
    expect(mutation).toContain("b.stripe_checkout_session_id =");
    expect(mutation).toContain("b.stripe_subscription_id is null");
    expect(mutation).toContain("b.status = 'pending'");
    expect(mutation).toContain("stripe_subscription_id =");
    expect(mutation).toContain("stripe_customer_id =");
    expect(preflightParams).toContain(ws);
    expect(updateParams).toContain(checkoutProof.id);
    expect(updateParams).toContain("sub_test");
    expect(updateParams).toContain("cus_test");
    expect(mocks.syncWorkspaceAiChat).toHaveBeenCalledWith({ workspaceId: ws, enabled: false });
  });

  it.each([
    ["wrong subscription", { subscription: "sub_other" }],
    ["wrong customer", { customer: "cus_other" }],
    ["wrong Workspace claim", { metadata: { workspace_id: "f0000000-0000-4000-8000-000000000099" } }],
    ["wrong client reference", { client_reference_id: "f0000000-0000-4000-8000-000000000099" }],
    ["wrong Stripe livemode", { livemode: true }],
    ["incomplete Checkout", { status: "open" }],
    ["one-off payment mode", { mode: "payment" }],
  ])("does not bind a %s Checkout Session", async (_label, overrides) => {
    const retrieve = vi.fn().mockResolvedValue({ ...checkoutProof, ...overrides });
    const stripe = { checkout: { sessions: { retrieve } } } as unknown as Stripe;
    mocks.sql
      .mockResolvedValueOnce([{ stripe_checkout_session_id: checkoutProof.id }])
      .mockResolvedValueOnce([{ billing_count: 0, plan_count: 0, flag_count: 0 }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793900000, "price_old", stripe))
      .toEqual({ ok: false, code: "stale" });
    expect(mocks.syncWorkspaceAiChat).not.toHaveBeenCalled();
    const [sql, ...params] = mocks.sql.mock.calls[1];
    expect(sql.join("?")).toContain("b.stripe_checkout_session_id =");
    expect(params).toContain(null);
  });

  it("does not bind an unrelated replacement Checkout Session when the row changed during verification", async () => {
    const retrieve = vi.fn().mockResolvedValue(checkoutProof);
    const stripe = { checkout: { sessions: { retrieve } } } as unknown as Stripe;
    mocks.sql
      .mockResolvedValueOnce([{ stripe_checkout_session_id: checkoutProof.id }])
      .mockResolvedValueOnce([{ billing_count: 0, plan_count: 0, flag_count: 0 }])
      .mockResolvedValueOnce([{
        stripe_checkout_session_id: "cs_test_newer_workspace_checkout",
        stripe_subscription_id: null, status: "pending",
      }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793900000, "price_old", stripe))
      .toEqual({ ok: false, code: "stale" });
    expect(retrieve).toHaveBeenCalledWith(checkoutProof.id);
    expect(mocks.syncWorkspaceAiChat).not.toHaveBeenCalled();
  });

  it("retries a verified unbound Checkout when its Workspace plan is temporarily missing", async () => {
    const retrieve = vi.fn().mockResolvedValue(checkoutProof);
    const stripe = { checkout: { sessions: { retrieve } } } as unknown as Stripe;
    mocks.sql
      .mockResolvedValueOnce([{ stripe_checkout_session_id: checkoutProof.id }])
      .mockResolvedValueOnce([{ billing_count: 0, plan_count: 0, flag_count: 0 }])
      .mockResolvedValueOnce([{
        stripe_checkout_session_id: checkoutProof.id,
        stripe_subscription_id: null, status: "pending",
      }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793900000, "price_old", stripe))
      .toEqual({ ok: false, code: "database" });
    expect(mocks.syncWorkspaceAiChat).not.toHaveBeenCalled();
  });

  it("does not adopt a missing pending Checkout identity based only on subscription metadata", async () => {
    const retrieve = vi.fn();
    const stripe = { checkout: { sessions: { retrieve } } } as unknown as Stripe;
    mocks.sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ billing_count: 0, plan_count: 0, flag_count: 0 }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793900000, "price_old", stripe))
      .toEqual({ ok: false, code: "stale" });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("returns a retryable database error when Stripe Checkout verification is temporarily unavailable", async () => {
    const stripe = {
      checkout: { sessions: { retrieve: vi.fn().mockRejectedValue(new Error("test-only provider failure")) } },
    } as unknown as Stripe;
    mocks.sql.mockResolvedValueOnce([{ stripe_checkout_session_id: checkoutProof.id }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793900000, "price_old", stripe))
      .toEqual({ ok: false, code: "database" });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.syncWorkspaceAiChat).not.toHaveBeenCalled();
  });

  it("preserves normal cancellations without a Checkout lookup when the Subscription is already bound", async () => {
    const retrieve = vi.fn();
    const stripe = { checkout: { sessions: { retrieve } } } as unknown as Stripe;
    mocks.sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ billing_count: 1, plan_count: 1, flag_count: 4 }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793900000, "price_old", stripe))
      .toEqual({ ok: true });
    expect(retrieve).not.toHaveBeenCalled();
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });

  it("cannot change a new binding that replaced the refunded subscription", async () => {
    mocks.sql.mockResolvedValue([{
      billing_count: 0, plan_count: 0, flag_count: 0,
    }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793890000, "price_old"))
      .toEqual({ ok: false, code: "stale" });
    expect(mocks.syncWorkspaceAiChat).not.toHaveBeenCalled();
  });

  it("returns retryable database failure for an incomplete atomic projection", async () => {
    mocks.sql.mockResolvedValue([{
      billing_count: 1, plan_count: 0, flag_count: 4,
    }]);
    expect(await syncCancelledWorkspaceSubscription(sub, 1793890000, "price_old"))
      .toEqual({ ok: false, code: "database" });
  });

  it("returns retryable database failure on a SQL exception", async () => {
    mocks.sql.mockRejectedValue(new Error("test-only SQL failure"));
    expect(await syncCancelledWorkspaceSubscription(sub, 1793890000, "price_old"))
      .toEqual({ ok: false, code: "database" });
  });

  it("rejects mismatched Price and non-canceled subscription", async () => {
    expect(await syncCancelledWorkspaceSubscription(sub, 1793890000, "price_other"))
      .toEqual({ ok: false, code: "ignored" });
    expect(await syncCancelledWorkspaceSubscription({ ...sub, status: "active" }, 1793890000, "price_old"))
      .toEqual({ ok: false, code: "ignored" });
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("routes canceled subscription webhooks through the same atomic binding gate", async () => {
    expect(await syncWorkspaceSubscription(sub, 1793890000, "starter", "price_old"))
      .toEqual({ ok: true });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});
