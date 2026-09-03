import type { AnalyticsEnvironment } from "../public-site-domains";

export const ANALYTICS_CONSENT_STORAGE_KEY = "proffera:analytics-consent:v1";
export const ANALYTICS_CONSENT_CHANGED_EVENT = "proffera:analytics-consent-changed";

export type AnalyticsConsentState = "granted" | "denied" | "unknown";
export type PersistedAnalyticsConsentState = Exclude<AnalyticsConsentState, "unknown">;
export type AnalyticsSource =
  | "direct"
  | "proffera"
  | "google"
  | "bing"
  | "duckduckgo"
  | "yahoo"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "external";

export type PostHogPublicConfig = {
  key: string;
  host: string;
  environment: AnalyticsEnvironment;
};

type PublicAnalyticsEnvironment = Record<string, string | undefined>;

type AnalyticsEvent = {
  event?: string;
  properties?: Record<string, unknown>;
};

type AnalyticsConsentStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const PERSON_OR_ORGANIZATION_NUMBER = /^(?:\d{6}[-+]?\d{4}|\d{8}[-+]?\d{4}|\d{10}|\d{12})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_HEX_OR_TOKEN = /^(?:[0-9a-f]{20,}|[A-Za-z0-9_-]{24,})$/;
const DOT_DELIMITED_TOKEN = /^(?=.{24,}$)[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/;
const LONG_NUMERIC_ID = /^\d{6,}$/;
const EMAIL_LIKE = /^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/;

const allowedAnalyticsSources = new Set<AnalyticsSource>([
  "direct",
  "proffera",
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "linkedin",
  "facebook",
  "instagram",
  "tiktok",
  "external",
]);

const allowedAnonymousIdentityProperties = [
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
] as const;

function isSensitiveSegment(segment: string) {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Invalid encoding is safer to redact than to forward verbatim.
    return true;
  }

  return (
    PERSON_OR_ORGANIZATION_NUMBER.test(decoded) ||
    UUID.test(decoded) ||
    LONG_HEX_OR_TOKEN.test(decoded) ||
    DOT_DELIMITED_TOKEN.test(decoded) ||
    LONG_NUMERIC_ID.test(decoded) ||
    EMAIL_LIKE.test(decoded)
  );
}

function normalizePostHogHost(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.port || url.search || url.hash) return null;
    if (url.pathname && url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function analyticsConsentFromStoredValue(value: string | null | undefined): AnalyticsConsentState {
  if (value === "granted" || value === "denied") return value;
  return "unknown";
}

export function readAnalyticsConsent(
  storage: Pick<AnalyticsConsentStorage, "getItem">,
): AnalyticsConsentState {
  try {
    return analyticsConsentFromStoredValue(storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
  } catch {
    return "unknown";
  }
}

export function persistAnalyticsConsent(
  storage: Pick<AnalyticsConsentStorage, "setItem">,
  consent: PersistedAnalyticsConsentState,
  notifyChange: () => void,
) {
  try {
    storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  } catch {
    return false;
  }

  notifyChange();
  return true;
}

export function isAnalyticsConsentGranted(consent: AnalyticsConsentState) {
  return consent === "granted";
}

export function getAnalyticsEnvironment(vercelEnvironment: string | undefined) {
  if (vercelEnvironment === "production") return "production" as const;
  if (vercelEnvironment === "preview") return "preview" as const;
  return null;
}

export function resolvePostHogConfig(
  environment: PublicAnalyticsEnvironment = process.env,
): PostHogPublicConfig | null {
  const analyticsEnvironment = getAnalyticsEnvironment(environment.VERCEL_ENV);
  if (!analyticsEnvironment) return null;

  const key =
    analyticsEnvironment === "production"
      ? environment.NEXT_PUBLIC_POSTHOG_KEY?.trim()
      : environment.NEXT_PUBLIC_POSTHOG_PREVIEW_KEY?.trim();
  const host = normalizePostHogHost(
    analyticsEnvironment === "production"
      ? environment.NEXT_PUBLIC_POSTHOG_HOST
      : environment.NEXT_PUBLIC_POSTHOG_PREVIEW_HOST,
  );

  if (!key || !host) return null;

  return {
    key,
    host,
    environment: analyticsEnvironment,
  };
}

export function sanitizeAnalyticsPathname(pathname: string) {
  const rawPath = pathname.split(/[?#]/, 1)[0] || "/";
  const segments = rawPath.split("/").map((segment) => {
    if (!segment) return segment;
    return isSensitiveSegment(segment) ? ":redacted" : segment;
  });
  const sanitized = segments.join("/");
  return sanitized.startsWith("/") ? sanitized : `/${sanitized}`;
}

export function sanitizePageUrl(origin: string, pathname: string) {
  try {
    const url = new URL(origin);
    if (!/^https?:$/.test(url.protocol)) return sanitizeAnalyticsPathname(pathname);
    return `${url.origin}${sanitizeAnalyticsPathname(pathname)}`;
  } catch {
    return sanitizeAnalyticsPathname(pathname);
  }
}

function sanitizeCapturedUrl(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;

  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return sanitizeAnalyticsPathname(url.pathname);
    return sanitizePageUrl(url.origin, url.pathname);
  } catch {
    return sanitizeAnalyticsPathname(value);
  }
}

export function analyticsSourceFromReferrer(rawReferrer: string): AnalyticsSource {
  if (!rawReferrer) return "direct";

  try {
    const hostname = new URL(rawReferrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname) return "external";
    if (hostname === "proffera.se" || hostname.endsWith(".proffera.se")) return "proffera";
    if (hostname === "google.com" || hostname.endsWith(".google.com")) return "google";
    if (hostname === "bing.com" || hostname.endsWith(".bing.com")) return "bing";
    if (hostname === "duckduckgo.com") return "duckduckgo";
    if (hostname === "yahoo.com" || hostname.endsWith(".yahoo.com")) return "yahoo";
    if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) return "linkedin";
    if (hostname === "facebook.com" || hostname.endsWith(".facebook.com")) return "facebook";
    if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return "instagram";
    if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) return "tiktok";
    return "external";
  } catch {
    return "external";
  }
}

export function shouldCapturePageview(lastPageKey: string | null, nextPageKey: string) {
  return lastPageKey !== nextPageKey;
}

export function sanitizePostHogEvent<T extends AnalyticsEvent>(event: T | null): T | null {
  if (!event || event.event !== "$pageview") return null;

  const source = event.properties ?? {};
  const rawSource = typeof source.source === "string" ? source.source : undefined;
  const properties: Record<string, unknown> = {
    $current_url: sanitizeCapturedUrl(source.$current_url),
    $pathname:
      typeof source.$pathname === "string" ? sanitizeAnalyticsPathname(source.$pathname) : undefined,
    proffera_environment:
      source.proffera_environment === "production" || source.proffera_environment === "preview"
        ? source.proffera_environment
        : undefined,
    source:
      rawSource && allowedAnalyticsSources.has(rawSource as AnalyticsSource)
        ? rawSource
        : rawSource
          ? "external"
          : undefined,
    $process_person_profile: false,
  };

  for (const property of allowedAnonymousIdentityProperties) {
    const value = source[property];
    if (typeof value === "string" && value) properties[property] = value;
  }

  for (const key of Object.keys(properties)) {
    if (properties[key] === undefined) delete properties[key];
  }

  return { ...event, properties } as T;
}
