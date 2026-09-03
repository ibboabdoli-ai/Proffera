import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsPathname } from "../src/lib/analytics/posthog-privacy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PostHog final review regressions", () => {
  it("preserves canonical public directory slugs on profile and claim routes", () => {
    const publicSlug = "example-elektriska-ab-115707";
    const soleTraderSlug = "my-very-long-sole-trader-company-12345678";

    expect(sanitizeAnalyticsPathname(`/foretag/listad/${publicSlug}`)).toBe(
      `/foretag/listad/${publicSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/en/companies/${publicSlug}`)).toBe(
      `/en/companies/${publicSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/foretag/claim/${publicSlug}`)).toBe(
      `/foretag/claim/${publicSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/en/companies/claim/${publicSlug}`)).toBe(
      `/en/companies/claim/${publicSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/foretag/listad/${soleTraderSlug}`)).toBe(
      `/foretag/listad/${soleTraderSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/en/companies/${soleTraderSlug}`)).toBe(
      `/en/companies/${soleTraderSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/foretag/claim/${soleTraderSlug}`)).toBe(
      `/foretag/claim/${soleTraderSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/en/companies/claim/${soleTraderSlug}`)).toBe(
      `/en/companies/claim/${soleTraderSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/review/${publicSlug}`)).toBe("/review/:redacted");
    expect(sanitizeAnalyticsPathname(`/review/${soleTraderSlug}`)).toBe("/review/:redacted");
  });

  it("synchronizes analytics consent changes and storage clears across open tabs", () => {
    const privacy = source("src/lib/analytics/posthog-privacy.ts");
    const client = source("src/components/analytics/posthog-analytics.tsx");
    const control = source("src/components/analytics/analytics-consent-control.tsx");

    expect(privacy).toContain(
      'ANALYTICS_CONSENT_STORAGE_KEY = "proffera:analytics-consent:v1"',
    );
    expect(client).toContain("ANALYTICS_CONSENT_STORAGE_KEY,");
    expect(client).toContain("event.key !== null && event.key !== ANALYTICS_CONSENT_STORAGE_KEY");
    expect(control).toContain("event.key !== null && event.key !== ANALYTICS_CONSENT_STORAGE_KEY");
    expect(client).toContain('window.addEventListener("storage", handleStorageChange)');
    expect(client).toContain('if (consent === "unknown")');
    expect(client).toContain("posthog?.opt_out_capturing()");
    expect(control).toContain('window.addEventListener("storage", syncConsentFromStorage)');
  });

  it("localizes the neutral consent control for document, route-level and query-localized flows", () => {
    const layout = source("src/app/layout.tsx");
    const control = source("src/components/analytics/analytics-consent-control.tsx");
    const guestQuote = source("src/app/offert/svara/[token]/page.tsx");
    const booking = source("src/app/boka/[slug]/page.tsx");
    const offer = source("src/app/offert/[token]/page.tsx");

    expect(layout).toContain("{isPlatformSite && <AnalyticsConsentControl />}");
    expect(control).toContain('new URLSearchParams(window.location.search).get("lang")');
    expect(control).toContain('document.querySelector<HTMLElement>("main[lang]")');
    expect(control).toContain("document.documentElement.lang");
    expect(control).toContain("new MutationObserver");
    expect(guestQuote).toContain("<main lang={locale}");
    expect(booking).toContain("query?.lang");
    expect(offer).toContain("query?.lang");
    expect(control).toContain("Analytics settings");
    expect(control).toContain("Reject analytics");
    expect(control).toContain("Allow analytics");
    expect(control).toContain("Nothing is sent before you choose to allow analytics.");
  });

  it("documents optional consented PostHog analytics in both cookie policies", () => {
    const swedish = source("src/app/cookies/page.tsx");
    const english = source("src/app/en/cookies/page.tsx");

    expect(swedish).toContain("PostHog");
    expect(swedish).toContain("uttryckligt");
    expect(swedish).not.toContain("införs i framtiden");
    expect(english).toContain("PostHog");
    expect(english).toContain("explicitly choose");
    expect(english).not.toContain("introduced in the future");
  });
});
