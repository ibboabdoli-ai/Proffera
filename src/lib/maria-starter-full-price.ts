import "server-only";
import { getSql } from "@/lib/db/server";
import { getStripeClient, getStripePriceIdForPlan } from "@/lib/stripe";
import { getStarterFullPriceQuote, type StarterFullPriceQuote } from "@/lib/maria-starter-full-price-policy";
import { syncWorkspaceSubscription } from "@/lib/workspace-billing";

async function readCurrentQuote(workspaceId: string) {
  const sql = getSql();
  const stripe = getStripeClient();
  const expectedPriceId = getStripePriceIdForPlan("starter");
  if (!sql || !stripe || !expectedPriceId) return null;
  const rows = await sql`
    select b.stripe_subscription_id, b.status, b.stripe_customer_id, p.plan_key, p.status as plan_status
    from workspace_billing_subscriptions b
    join workspace_plans p on p.id=b.workspace_plan_id and p.workspace_id=b.workspace_id
    where b.workspace_id=${workspaceId}::uuid limit 1
  `;
  const billing = rows[0];
  if (billing?.status !== "active" || billing?.plan_status !== "active"
    || billing?.plan_key !== "starter" || !billing?.stripe_customer_id
    || typeof billing.stripe_subscription_id !== "string") return null;
  const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id, {
    expand: ["latest_invoice", "discounts"],
  });
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer : subscription.customer?.id;
  if (customerId !== billing.stripe_customer_id) return null;
  const quote = getStarterFullPriceQuote(subscription, workspaceId, expectedPriceId);
  if (!quote) return null;
  // Avoid quoting a fixed amount when extra tax could be collected.
  if (subscription.items.data[0]?.price.tax_behavior !== "inclusive") return null;
  return { quote, stripe, expectedPriceId, subscription };
}

export async function getMariaStarterFullPriceQuote(workspaceId: string): Promise<StarterFullPriceQuote | null> {
  try { return (await readCurrentQuote(workspaceId))?.quote ?? null; }
  catch (error) { console.error("Unable to read Starter quote", error); return null; }
}

export async function acceptMariaStarterFullPrice(input: {
  workspaceId: string; userId: string; subscriptionId: string; discountId: string;
  periodEnd: number; nextAmountOre: number; acknowledged: boolean; confirmation: string;
}): Promise<"updated" | "stale" | "error"> {
  if (!input.acknowledged || input.confirmation.trim() !== "CONFIRM 299 SEK"
    || input.nextAmountOre !== 29900 || !Number.isSafeInteger(input.periodEnd)) return "stale";
  try {
    const result = await readCurrentQuote(input.workspaceId);
    if (!result) return "stale";
    const { quote, stripe, expectedPriceId, subscription } = result;
    if (quote.subscriptionId !== input.subscriptionId || quote.discountId !== input.discountId
      || quote.periodEnd !== input.periodEnd || quote.nextAmountOre !== input.nextAmountOre) return "stale";
    const updated = await stripe.subscriptions.update(quote.subscriptionId, {
      // Same Subscription and Price. Stripe requires an empty string to
      // clear discounts. [] leaves the existing coupon unchanged.
      discounts: "", proration_behavior: "none",
      metadata: {
        ...subscription.metadata,
        starter_full_price_prior_discount_id: quote.discountId,
        starter_full_price_price_id: expectedPriceId,
        starter_full_price_effective_at: String(quote.periodEnd),
        starter_full_price_approved_by: input.userId,
        starter_full_price_approved_at: String(Math.floor(Date.now() / 1000)),
      },
    }, { idempotencyKey: "maria-starter-full-v1-" + quote.subscriptionId + "-" + quote.periodEnd });
    if (updated.id !== quote.subscriptionId
      || updated.items.data[0]?.price.id !== expectedPriceId
      || !Array.isArray(updated.discounts) || updated.discounts.length !== 0
      || updated.pending_update) return "error";
    const current = await stripe.subscriptions.retrieve(quote.subscriptionId, {
      expand: ["latest_invoice", "discounts"],
    });
    if (current.id !== quote.subscriptionId
      || current.items.data[0]?.price.id !== expectedPriceId
      || !Array.isArray(current.discounts) || current.discounts.length !== 0
      || current.pending_update) return "error";
    // Never report an unverified Stripe mutation as successful.
    const applied = await syncWorkspaceSubscription(current, Math.floor(Date.now() / 1000),
      "starter", expectedPriceId);
    return applied.ok ? "updated" : "error";
  } catch (error) {
    console.error("Starter full-price conversion failed", error);
    return "error";
  }
}
