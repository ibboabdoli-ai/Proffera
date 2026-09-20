import {
  sanitizeMarketplaceFunnelPostHogEvent,
} from "@/lib/analytics/marketplace-funnel-events";
import { sanitizePostHogEvent as sanitizePrivacySafePostHogEvent } from "./posthog-privacy";

type AnalyticsEvent = {
  event?: string;
  properties?: Record<string, unknown>;
};

const POSTHOG_PUBLIC_PROJECT_TOKEN = /^phc_[A-Za-z0-9_-]{20,}$/;

export function sanitizePostHogEvent<T extends AnalyticsEvent>(event: T | null): T | null {
  const sanitized = (
    sanitizeMarketplaceFunnelPostHogEvent(event)
    ?? sanitizePrivacySafePostHogEvent(event)
  ) as T | null;
  if (!sanitized || !event?.properties) return sanitized;

  const projectToken = event.properties.token;
  if (typeof projectToken !== "string" || !POSTHOG_PUBLIC_PROJECT_TOKEN.test(projectToken)) {
    return sanitized;
  }

  return {
    ...sanitized,
    properties: {
      ...(sanitized.properties ?? {}),
      token: projectToken,
    },
  } as T;
}
