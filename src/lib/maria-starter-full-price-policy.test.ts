import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { getStarterFullPriceQuote } from "./maria-starter-full-price-policy";

vi.mock("@/lib/workspace-sms-quota", () => ({
  starterSmsLimitFromStripe: vi.fn(() => 50),
}));

const base = {
  id: "sub_same", status: "active", cancel_at_period_end: false,
  pending_update: null, metadata: { workspace_id: "workspace-test" },
  discounts: [{ id: "di_approved" }],
  items: { data: [{
    id: "si_old", quantity: 1, current_period_end: 1900000000,
    price: { id: "price_starter", currency: "sek", unit_amount: 29900, recurring: { interval: "month" } },
  }] },
} as unknown as Stripe.Subscription;

describe("discounted Starter 50 to full-price Starter 100 quote", () => {
  it("requires same Stripe-linked workspace, paid Starter and a one-item monthly price", () => {
    const quote = getStarterFullPriceQuote(base, "workspace-test", "price_starter", 1800000000);
    expect(quote).toMatchObject({
      subscriptionId: "sub_same", discountId: "di_approved",
      periodEnd: 1900000000, currentAmountOre: 15000, nextAmountOre: 29900,
    });
    expect(getStarterFullPriceQuote(base, "other-tenant", "price_starter", 1800000000)).toBeNull();
    expect(getStarterFullPriceQuote({...base, status: "trialing"} as Stripe.Subscription, "workspace-test", "price_starter", 1800000000)).toBeNull();
    expect(getStarterFullPriceQuote({...base, pending_update: {}} as Stripe.Subscription, "workspace-test", "price_starter", 1800000000)).toBeNull();
    expect(getStarterFullPriceQuote({...base, discounts: []} as Stripe.Subscription, "workspace-test", "price_starter", 1800000000)).toBeNull();
    expect(getStarterFullPriceQuote(base, "workspace-test", "price_starter", 1900000001)).toBeNull();
  });
});
