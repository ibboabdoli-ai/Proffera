import type Stripe from "stripe";
import { starterSmsLimitFromStripe } from "@/lib/workspace-sms-quota";

// An upgrade removes only the verified one-use STARTER150 discount on the SAME subscription.
// The currently paid discounted invoice remains authoritative until renewal.
export type StarterFullPriceQuote = {
  subscriptionId: string;
  discountId: string;
  periodEnd: number;
  nextAmountOre: 29900;
  currentAmountOre: 15000;
  currency: "sek";
};

export function getStarterFullPriceQuote(
  subscription: Stripe.Subscription,
  workspaceId: string,
  expectedStarterPriceId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): StarterFullPriceQuote | null {
  const item = subscription.items.data[0];
  const discounts = subscription.discounts;
  if (subscription.metadata?.workspace_id !== workspaceId
    || subscription.status !== "active"
    || subscription.cancel_at_period_end
    || subscription.pending_update
    || subscription.items.data.length !== 1
    || !item || item.price?.id !== expectedStarterPriceId
    || item.price.currency !== "sek" || item.price.unit_amount !== 29900
    || item.quantity !== 1 || item.price.recurring?.interval !== "month"
    || !Number.isSafeInteger(item.current_period_end)
    || item.current_period_end <= nowSeconds
    || !Array.isArray(discounts) || discounts.length !== 1
    || typeof discounts[0] === "string"
    || starterSmsLimitFromStripe(subscription) !== 50
  ) return null;
  return {
    subscriptionId: subscription.id,
    discountId: discounts[0].id,
    periodEnd: item.current_period_end,
    nextAmountOre: 29900,
    currentAmountOre: 15000,
    currency: "sek",
  };
}
