import type { AnalyticsEnvironment } from "@/lib/public-site-domains";

export const MARKETPLACE_FUNNEL_BROWSER_EVENT = "proffera:marketplace-funnel-event";

export const MARKETPLACE_FUNNEL_EVENT_NAMES = [
  "marketplace_discovery_search_completed",
  "marketplace_request_submitted",
  "marketplace_invitation_outcome",
  "marketplace_provider_offer_submitted",
  "marketplace_customer_selection_completed",
  "marketplace_service_job_completed",
  "marketplace_verified_review_submitted",
] as const;

export type MarketplaceFunnelEventName = (typeof MARKETPLACE_FUNNEL_EVENT_NAMES)[number];
export type MarketplaceFunnelLocale = "sv" | "en";
export type MarketplaceDiscoveryResultBand = "none" | "1-5" | "6-20" | "21+";
export type MarketplaceInvitationOutcome = "invited";
export type MarketplaceOfferPriceKind = "fixed" | "estimate" | "inspection_required";

export type MarketplaceFunnelEventInput = {
  event: MarketplaceFunnelEventName;
  properties?: Record<string, unknown>;
};

export type MarketplaceFunnelPostHogEvent = {
  event: MarketplaceFunnelEventName;
  properties: Record<string, unknown> & {
    proffera_environment: AnalyticsEnvironment;
    $process_person_profile: false;
  };
};

const eventNames = new Set<string>(MARKETPLACE_FUNNEL_EVENT_NAMES);
const locales = new Set<MarketplaceFunnelLocale>(["sv", "en"]);
const resultBands = new Set<MarketplaceDiscoveryResultBand>(["none", "1-5", "6-20", "21+"]);
const invitationOutcomes = new Set<MarketplaceInvitationOutcome>(["invited"]);
const priceKinds = new Set<MarketplaceOfferPriceKind>(["fixed", "estimate", "inspection_required"]);

function safeLocale(value: unknown) {
  return typeof value === "string" && locales.has(value as MarketplaceFunnelLocale)
    ? value as MarketplaceFunnelLocale
    : undefined;
}

function sanitizeAllowedProperties(event: MarketplaceFunnelEventName, source: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  const locale = safeLocale(source.locale);
  if (locale) properties.locale = locale;

  if (event === "marketplace_discovery_search_completed") {
    const resultBand = source.result_band;
    if (typeof resultBand === "string" && resultBands.has(resultBand as MarketplaceDiscoveryResultBand)) {
      properties.result_band = resultBand;
    }
  }

  if (event === "marketplace_invitation_outcome") {
    const outcome = source.outcome;
    if (typeof outcome === "string" && invitationOutcomes.has(outcome as MarketplaceInvitationOutcome)) {
      properties.outcome = outcome;
    }
  }

  if (event === "marketplace_provider_offer_submitted") {
    const priceKind = source.price_kind;
    if (typeof priceKind === "string" && priceKinds.has(priceKind as MarketplaceOfferPriceKind)) {
      properties.price_kind = priceKind;
    }
  }

  return properties;
}

export function sanitizeMarketplaceFunnelEventInput(input: unknown): MarketplaceFunnelEventInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as { event?: unknown; properties?: unknown };
  if (typeof candidate.event !== "string" || !eventNames.has(candidate.event)) return null;
  if (candidate.properties !== undefined && (!candidate.properties || typeof candidate.properties !== "object" || Array.isArray(candidate.properties))) {
    return null;
  }

  const event = candidate.event as MarketplaceFunnelEventName;
  const source = (candidate.properties ?? {}) as Record<string, unknown>;
  return { event, properties: sanitizeAllowedProperties(event, source) };
}

export function buildMarketplaceFunnelPostHogEvent(
  input: unknown,
  environment: AnalyticsEnvironment,
): MarketplaceFunnelPostHogEvent | null {
  if (environment !== "production" && environment !== "preview") return null;
  const sanitized = sanitizeMarketplaceFunnelEventInput(input);
  if (!sanitized) return null;

  return {
    event: sanitized.event,
    properties: {
      ...(sanitized.properties ?? {}),
      proffera_environment: environment,
      $process_person_profile: false,
    },
  };
}

export function sanitizeMarketplaceFunnelPostHogEvent(input: unknown): MarketplaceFunnelPostHogEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as { event?: unknown; properties?: unknown };
  if (!candidate.properties || typeof candidate.properties !== "object" || Array.isArray(candidate.properties)) return null;
  const source = candidate.properties as Record<string, unknown>;
  const environment = source.proffera_environment;
  if (environment !== "production" && environment !== "preview") return null;
  return buildMarketplaceFunnelPostHogEvent(candidate, environment);
}
