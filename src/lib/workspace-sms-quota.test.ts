import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { countSmsSegments, starterSmsLimitFromStripe } from "./workspace-sms-quota";

const periodStart = 1793800000;
const periodEnd = 1796392000;
const basePrice = 29900;
const discountId = "di_starter150";
const promo = {
  id: discountId,
  source: { type: "coupon", coupon: "PROFFERA_STARTER150_20261102" },
  promotion_code: "promo_1UXOoTIje09L34ksVhsBKBWJ",
};
const fullLine = {
  id: "il_synthetic",
  amount: basePrice,
  currency: "sek",
  discounts: [] as unknown[],
  discount_amounts: [] as unknown[],
  parent: {
    type: "subscription_item_details",
    subscription_item_details: {
      subscription: "sub_test",
      subscription_item: "si_starter",
      proration: false,
    },
  },
  period: { start: periodStart, end: periodEnd },
  pricing: { type: "price_details", price_details: { price: "price_starter_299" } },
};
function subscription(overrides: Record<string, unknown> = {}, lineOverrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test",
    customer: "cus_test",
    status: "active",
    items: { data: [{ id: "si_starter", price: {
      id: "price_starter_299", unit_amount: basePrice, currency: "sek",
    }, current_period_start: periodStart, current_period_end: periodEnd }] },
    latest_invoice: {
      id: "in_paid_test",
      status: "paid",
      amount_paid: basePrice,
      currency: "sek",
      customer: "cus_test",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_test" } },
      lines: { data: [{ ...fullLine, ...lineOverrides }], has_more: false },
    },
    discounts: [],
    ...overrides,
  } as unknown as Stripe.Subscription;
}
function discounted() {
  return subscription({
    latest_invoice: {
      ...subscription().latest_invoice as Stripe.Invoice,
      amount_paid: 15000,
      lines: { data: [{
        ...fullLine,
        discount_amounts: [{ amount:14900, discount: discountId }],
        discounts: [discountId],
      }], has_more:false },
    },
    discounts: [promo],
  });
}

describe("Starter SMS quota tied to actual current Stripe invoice line", () => {
  it("gives 100 only for current full-price paid Starter line", () => {
    expect(starterSmsLimitFromStripe(subscription())).toBe(100);
    expect(starterSmsLimitFromStripe(subscription({status:"trialing"}))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({status:"past_due"}))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({latest_invoice:"in_unexpanded"}))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({latest_invoice:{
      ...subscription().latest_invoice as Stripe.Invoice, status:"open",
    }}))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({latest_invoice:{
      ...subscription().latest_invoice as Stripe.Invoice, amount_paid:15000,
    }}))).toBeNull();
  });

  it("gives 50 only for a 149 SEK STARTER150 discount on this line", () => {
    expect(starterSmsLimitFromStripe(discounted())).toBe(50);
    expect(starterSmsLimitFromStripe(subscription({
      ...discounted(), discounts:[{...promo,promotion_code:null}],
    }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({
      ...discounted(), discounts:[{...promo,source:{type:"coupon",coupon:"different"}}],
    }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({
      ...discounted(), discounts:[promo,promo],
    }))).toBeNull();
  });

  it("does not grant 100 for an invoice-only discounted Starter plus unrelated charges", () => {
    const itemDiscount = {...fullLine,discount_amounts:[{amount:14900,discount:"di_invoice"}],discounts:["di_invoice"]};
    const invoice = subscription().latest_invoice as Stripe.Invoice;
    expect(starterSmsLimitFromStripe(subscription({
      latest_invoice:{
        ...invoice,amount_paid:29900,
        lines:{has_more:false,data:[itemDiscount,{
          ...fullLine,id:"il_other",amount:14900,
          parent:{type:"invoice_item_details",invoice_item_details:{subscription:null}},
        }]},
      },
    }))).toBeNull();
  });

  it("fails closed for stale invoices, mismatched subscriptions and prorations", () => {
    expect(starterSmsLimitFromStripe(subscription({},{
      period:{start:periodStart-100,end:periodEnd-100},
    }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({},{
      parent:{type:"subscription_item_details",subscription_item_details:{
        subscription:"sub_other",subscription_item:"si_starter",proration:false,
      }},
    }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({},{
      parent:{type:"subscription_item_details",subscription_item_details:{
        subscription:"sub_test",subscription_item:"si_starter",proration:true,
      }},
    }))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({latest_invoice:{
      ...subscription().latest_invoice as Stripe.Invoice,
      parent:{type:"subscription_details",subscription_details:{subscription:"sub_other"}},
    }}))).toBeNull();
    expect(starterSmsLimitFromStripe(subscription({latest_invoice:{
      ...subscription().latest_invoice as Stripe.Invoice,lines:{data:[fullLine],has_more:true},
    }}))).toBeNull();
  });

  it("charges conservative GSM-7 and Unicode segments", () => {
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

describe("same-subscription Starter full-price transition", () => {
  it("keeps 50 for the paid discounted period after owner-approved coupon removal", () => {
    const prior = discounted();
    const upgraded = {
      ...prior,
      latest_invoice: {
        ...prior.latest_invoice as Stripe.Invoice,
        lines: { data: [{
          ...((prior.latest_invoice as Stripe.Invoice).lines.data[0]),
          discounts: [], // Actual Stripe TEST line shape after coupon removal
        }], has_more: false },
      },
      discounts: [],
      metadata: {
        starter_full_price_prior_discount_id: discountId,
        starter_full_price_price_id: "price_starter_299",
        starter_full_price_effective_at: String(periodEnd),
      },
    } as unknown as Stripe.Subscription;
    expect(starterSmsLimitFromStripe(upgraded)).toBe(50);
    expect(starterSmsLimitFromStripe({ ...upgraded, metadata: {} })).toBeNull();
    expect(starterSmsLimitFromStripe({ ...upgraded, metadata: {
      ...upgraded.metadata, starter_full_price_effective_at: String(periodEnd - 1),
    } })).toBeNull();
    expect(starterSmsLimitFromStripe({ ...upgraded, latest_invoice: subscription().latest_invoice })).toBe(100);
  });
});

describe("Stripe test/live discount isolation", () => {
  it("fails closed on TEST without explicit TEST coupon and promo IDs", () => {
    const savedCoupon=process.env.STRIPE_TEST_STARTER_COUPON_ID;
    const savedPromo=process.env.STRIPE_TEST_STARTER_PROMOTION_ID;
    try {
      delete process.env.STRIPE_TEST_STARTER_COUPON_ID;
      delete process.env.STRIPE_TEST_STARTER_PROMOTION_ID;
      expect(starterSmsLimitFromStripe({...discounted(), livemode:false} as Stripe.Subscription)).toBeNull();
      // A fully paid full-price Starter has no coupon and requires no test promo config.
      expect(starterSmsLimitFromStripe({...subscription(), livemode:false} as Stripe.Subscription)).toBe(100);
      process.env.STRIPE_TEST_STARTER_COUPON_ID="PROFFERA_STARTER150_20261102";
      process.env.STRIPE_TEST_STARTER_PROMOTION_ID="promo_1UXOoTIje09L34ksVhsBKBWJ";
      expect(starterSmsLimitFromStripe({...discounted(),livemode:false} as Stripe.Subscription)).toBe(50);
    } finally {
      if (savedCoupon === undefined) delete process.env.STRIPE_TEST_STARTER_COUPON_ID;
      else process.env.STRIPE_TEST_STARTER_COUPON_ID=savedCoupon;
      if (savedPromo === undefined) delete process.env.STRIPE_TEST_STARTER_PROMOTION_ID;
      else process.env.STRIPE_TEST_STARTER_PROMOTION_ID=savedPromo;
    }
  });
});
