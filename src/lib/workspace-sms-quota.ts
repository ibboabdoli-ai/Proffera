import type Stripe from "stripe";

// The one-use promotion remains discounted for the redeemed subscription's
// renewals (Stripe coupon duration=forever). Do not infer it from typed code
// or mutable Workspace metadata.
const STARTER_DISCOUNT_COUPON = "PROFFERA_STARTER150_20261102";
const STARTER_PROMOTION_ID = "promo_1UXOoTIje09L34ksVhsBKBWJ";

export function starterSmsLimitFromStripe(subscription: Stripe.Subscription): 50 | 100 | null {
  if (subscription.status !== "active") return null;
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string" || invoice.status !== "paid") return null;

  // Removing a coupon does not prove that the additional amount has been
  // paid. Do not unlock 100 units using a previously discounted paid invoice.
  const priceAmount = subscription.items?.data[0]?.price?.unit_amount;
  const paidAmount = invoice.amount_paid;
  if (!Number.isInteger(priceAmount) || !Number.isInteger(paidAmount)
    || priceAmount === null || priceAmount <= 0 || paidAmount < 0) return null;
  const discounts = subscription.discounts;
  if (!Array.isArray(discounts)) return null;
  if (discounts.length === 0) return paidAmount >= priceAmount ? 100 : null;
  // Unknown/stacked discounts must not masquerade as a full-price purchase.
  if (discounts.length !== 1 || typeof discounts[0] === "string") return null;
  const discount = discounts[0];
  const sourceCoupon = discount.source?.coupon;
  const couponId = typeof sourceCoupon === "string" ? sourceCoupon : sourceCoupon?.id;
  const promotion = discount.promotion_code;
  const promotionId = typeof promotion === "string" ? promotion : promotion?.id;
  return couponId === STARTER_DISCOUNT_COUPON && promotionId === STARTER_PROMOTION_ID
    && paidAmount >= Math.max(1, priceAmount - 14900) ? 50 : null;
}

// Count Brevo billable SMS segments (GSM-7 vs Unicode) conservatively.
// GSM-7 extension symbols consume two septets. Unrecognized characters
// trigger Unicode UCS-2 limits, including UTF-16 surrogate pairs.
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
