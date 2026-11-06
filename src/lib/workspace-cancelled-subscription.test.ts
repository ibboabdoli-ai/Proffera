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
    expect(query).toContain("b.stripe_price_id =");
    expect(query).toContain("from changed_billing b");
    expect(query).toContain("greatest(coalesce(b.last_event_created, 0)");
    expect(parameters).toContain("sub_test");
    expect(parameters).toContain("cus_test");
    expect(mocks.syncWorkspaceAiChat).toHaveBeenCalledWith({
      workspaceId: ws, enabled: false,
    });
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
