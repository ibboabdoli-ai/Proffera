import type Stripe from "stripe";

const STARTER_DISCOUNT_COUPON = "PROFFERA_STARTER150_20261102";
const STARTER_PROMOTION_ID = "promo_1UXOoTIje09L34ksVhsBKBWJ";

function idOf(value: { id: string } | string | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

/**
 * Grant SMS units only when the current fully paid invoice has exactly one
 * non-prorated Starter subscription-item line for the current billing period.
 * Invoice-wide amount_paid cannot prove which item was discounted or paid.
 */
export function starterSmsLimitFromStripe(subscription: Stripe.Subscription): 50 | 100 | null {
  if (subscription.status !== "active") return null;
  const invoice = subscription.latest_invoice;
  const item = subscription.items?.data[0];
  if (!invoice || typeof invoice === "string" || invoice.status !== "paid"
    || !item?.id || !item.price?.id || item.price.currency !== "sek"
    || !Number.isSafeInteger(item.price.unit_amount) || !item.price.unit_amount
    || item.price.unit_amount <= 0
    || !item.current_period_start || !item.current_period_end
    || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0
    || invoice.currency !== "sek"
    || invoice.lines?.has_more !== false || !Array.isArray(invoice.lines.data)
    || idOf(invoice.parent?.subscription_details?.subscription) !== subscription.id
    || idOf(invoice.customer) !== idOf(subscription.customer)) return null;

  const matched = invoice.lines.data.filter(line =>
    line.parent?.type === "subscription_item_details"
    && line.parent.subscription_item_details?.proration === false
    && line.parent.subscription_item_details.subscription === subscription.id
    && line.parent.subscription_item_details.subscription_item === item.id
    && idOf(line.pricing?.price_details?.price) === item.price.id
    && line.period?.start === item.current_period_start
    && line.period?.end === item.current_period_end
    && line.currency === "sek");
  if (matched.length !== 1) return null;
  const line = matched[0];
  // Require the full recurring base amount: invoice items, partial/prorated
  // rows or another service's payment cannot make this line "full price".
  if (!Number.isSafeInteger(line.amount) || line.amount !== item.price.unit_amount
    || !Array.isArray(line.discount_amounts) || !Array.isArray(line.discounts)) return null;

  const totalLineDiscount = line.discount_amounts.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isSafeInteger(totalLineDiscount) || totalLineDiscount < 0
    || invoice.amount_paid < line.amount - totalLineDiscount) return null;
  const subscriptionDiscounts = subscription.discounts;
  if (!Array.isArray(subscriptionDiscounts)) return null;
  if (subscriptionDiscounts.length === 0) {
    if (line.discount_amounts.length === 0 && line.discounts.length === 0) return 100;
    // Owner-approved full-price upgrade: the old *paid* discounted invoice
    // still controls the current period after removing the forever coupon.
    // This marker is written only during a verified same-subscription change.
    const priorDiscountId = subscription.metadata?.starter_full_price_prior_discount_id;
    const effectivePeriodEnd = subscription.metadata?.starter_full_price_effective_at;
    const approvedPriceId = subscription.metadata?.starter_full_price_price_id;
    if (priorDiscountId && approvedPriceId === item.price.id
      && effectivePeriodEnd === String(item.current_period_end)
      && line.discount_amounts.length === 1
      && line.discount_amounts[0].amount === 14900
      && idOf(line.discount_amounts[0].discount) === priorDiscountId
      && (line.discounts.length === 0 || (line.discounts.length === 1
        && idOf(line.discounts[0]) === priorDiscountId))) return 50;
    return null;
  }

  // Stripe TEST and LIVE promotions have distinct IDs. Only the discounted
  // branch needs the TEST IDs; a full-price invoice does not require them.
  const expectedCoupon = subscription.livemode === false
    ? process.env.STRIPE_TEST_STARTER_COUPON_ID : STARTER_DISCOUNT_COUPON;
  const expectedPromotion = subscription.livemode === false
    ? process.env.STRIPE_TEST_STARTER_PROMOTION_ID : STARTER_PROMOTION_ID;
  if (!expectedCoupon || !expectedPromotion
    || subscriptionDiscounts.length !== 1 || typeof subscriptionDiscounts[0] === "string") return null;
  const discount = subscriptionDiscounts[0];
  if (idOf(discount.source?.coupon) !== expectedCoupon
    || idOf(discount.promotion_code) !== expectedPromotion) return null;
  // The actual PAID line must reflect the same 149 SEK coupon, not just a
  // coupon name applied to some other invoice item.
  if (line.discount_amounts.length !== 1
    || line.discount_amounts[0].amount !== 14900
    || idOf(line.discount_amounts[0].discount) !== discount.id) return null;
  return 50;
}

const GSM_BASIC = new Set(Array.from(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
));
const GSM_EXTENDED = new Set(Array.from("^{}\\[~]|€\f"));

export function countSmsSegments(content: string): number {
  if (!content || content.length > 20000) throw new Error("Invalid SMS length");
  let septets = 0;
  let gsm = true;
  for (const symbol of Array.from(content)) {
    if (GSM_BASIC.has(symbol)) septets += 1;
    else if (GSM_EXTENDED.has(symbol)) septets += 2;
    else { gsm = false; break; }
  }
  if (gsm) return septets <= 160 ? 1 : Math.ceil(septets / 153);
  return content.length <= 70 ? 1 : Math.ceil(content.length / 67);
}
