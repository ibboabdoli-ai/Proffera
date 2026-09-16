import {
  sanitizeMarketplaceFunnelEventInput,
  type MarketplaceFunnelEventInput,
  type MarketplaceFunnelEventName,
} from "@/lib/analytics/marketplace-funnel-events";

export const MARKETPLACE_FUNNEL_SIGNAL_COOKIE = "proffera_marketplace_funnel_signal";

export function marketplaceFunnelCookieValue(event: MarketplaceFunnelEventName) {
  return event;
}

export function marketplaceFunnelEventFromCookie(value: string | null | undefined): MarketplaceFunnelEventInput | null {
  if (!value) return null;
  return sanitizeMarketplaceFunnelEventInput({ event: value });
}
