import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { countSmsSegments, starterSmsLimitFromStripe } from "./workspace-sms-quota";

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    status: "active",
    latest_invoice: { status: "paid", amount_paid: 29900 },
    items: { data: [{ price: { unit_amount: 29900 } }] },
    discounts: [],
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("Starter SMS quota derived from verified Stripe billing", () => {
  it("grants 100 only to paid active subscriptions without discounts", () => {
    expect(starterSmsLimitFromStripe(subscription())).toBe(100);
    expect(starterSmsLimitFromStripe(subscription({ latest_invoice: "in_unexpanded" }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ latest_invoice: { status: "open" } }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ status: "trialing" }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ status: "past_due" }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ discounts: ["di_unknown"] }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ latest_invoice: { status: "paid", amount_paid: 15000 } }))).toBeNull();
  });

  it("grants 50 only for the applied STARTER150 promotion (not just any coupon)", () => {
    const promo = {
      id: "di_discount",
      source: { type: "coupon", coupon: "PROFFERA_STARTER150_20261102" },
      promotion_code: "promo_1UXOoTIje09L34ksVhsBKBWJ",
    };
    expect(starterSmsLimitFromStripe(subscription({ latest_invoice: { status: "paid", amount_paid: 15000 }, discounts: [promo] }))).toBe(50);
    expect(starterSmsLimitFromStripe(subscription({ latest_invoice: { status: "paid", amount_paid: 0 }, discounts: [promo] }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ discounts: [{ ...promo, promotion_code: null }] }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ discounts: [{ ...promo, source: { type: "coupon", coupon: "other" } }] }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({ discounts: [promo, promo] }))).toBeNull();
  });

  it("charges a conservative number of GSM-7 or Unicode segments", () => {
    expect(countSmsSegments("Hej!")).toBe(1);
    expect(countSmsSegments("åäö ÅÄÖ")).toBe(1);
    expect(countSmsSegments("a".repeat(160))).toBe(1);
    expect(countSmsSegments("a".repeat(161))).toBe(2);
    expect(countSmsSegments("^".repeat(81))).toBe(2);
    expect(countSmsSegments("س".repeat(70))).toBe(1);
    expect(countSmsSegments("س".repeat(71))).toBe(2);
    expect(countSmsSegments("😀".repeat(36))).toBe(2);
  });
});
