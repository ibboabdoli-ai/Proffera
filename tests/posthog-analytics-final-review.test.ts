import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyticsSourceFromReferrer,
  sanitizeAnalyticsPathname,
} from "../src/lib/analytics/posthog-privacy";

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

  it("preserves legitimate public service slugs while redacting sensitive service segments", () => {
    const workspaceSlug = "example-elektriska-ab-115707";
    const serviceSlug = "my-very-long-public-workspace-service";
    const personNumber = "198901011234";
    const organizationNumber = "556123-4567";
    const bearerToken = "abcdefghijklmnopqrstuvwx";

    expect(sanitizeAnalyticsPathname(`/foretag/${workspaceSlug}/tjanster/${serviceSlug}`)).toBe(
      `/foretag/${workspaceSlug}/tjanster/${serviceSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/foretag/${workspaceSlug}/tjanster/short-service`)).toBe(
      `/foretag/${workspaceSlug}/tjanster/short-service`,
    );
    expect(sanitizeAnalyticsPathname(`/foretag/${workspaceSlug}/tjanster/${personNumber}`)).toBe(
      `/foretag/${workspaceSlug}/tjanster/:redacted`,
    );
    expect(sanitizeAnalyticsPathname(`/foretag/${workspaceSlug}/tjanster/${organizationNumber}`)).toBe(
      `/foretag/${workspaceSlug}/tjanster/:redacted`,
    );
    expect(sanitizeAnalyticsPathname(`/foretag/${workspaceSlug}/tjanster/${bearerToken}`)).toBe(
      `/foretag/${workspaceSlug}/tjanster/:redacted`,
    );
    expect(sanitizeAnalyticsPathname(`/review/${serviceSlug}`)).toBe("/review/:redacted");
  });

  it("preserves canonical generated booking slugs only on the exact public booking route", () => {
    const bookingSlug = "very-long-company-derived-booking-slug-a1b2c3";
    const personNumber = "198901011234";
    const organizationNumber = "556123-4567";
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const numericId = "5592643778";
    const email = "person@example.com";
    const bearerToken = "abcdefghijklmnopqrstuvwx";
    const canonicalShapedBearerToken = "abcdefghijklmnopqrstuvwx-a1b2c3";
    const signedToken = "eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrstuvwxyz123456";

    expect(sanitizeAnalyticsPathname(`/boka/${bookingSlug}`)).toBe(`/boka/${bookingSlug}`);
    expect(sanitizeAnalyticsPathname(`/boka/${bookingSlug}/extra`)).toBe("/boka/:redacted/extra");
    expect(sanitizeAnalyticsPathname(`/review/${bookingSlug}`)).toBe("/review/:redacted");

    expect(sanitizeAnalyticsPathname(`/boka/${personNumber}`)).toBe("/boka/:redacted");
    expect(sanitizeAnalyticsPathname(`/boka/${organizationNumber}`)).toBe("/boka/:redacted");
    expect(sanitizeAnalyticsPathname(`/boka/${uuid}`)).toBe("/boka/:redacted");
    expect(sanitizeAnalyticsPathname(`/boka/${numericId}`)).toBe("/boka/:redacted");
    expect(sanitizeAnalyticsPathname(`/boka/${email}`)).toBe("/boka/:redacted");
    expect(sanitizeAnalyticsPathname(`/boka/${bearerToken}`)).toBe("/boka/:redacted");
    expect(sanitizeAnalyticsPathname(`/boka/${canonicalShapedBearerToken}`)).toBe("/boka/:redacted");
    expect(sanitizeAnalyticsPathname(`/boka/${signedToken}`)).toBe("/boka/:redacted");
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

  it("localizes the neutral consent control for English and Swedish client navigation plus query-localized flows", () => {
    const layout = source("src/app/layout.tsx");
    const control = source("src/components/analytics/analytics-consent-control.tsx");
    const guestQuote = source("src/app/offert/svara/[token]/page.tsx");
    const booking = source("src/app/boka/[slug]/page.tsx");
    const offer = source("src/app/offert/[token]/page.tsx");

    expect(layout).toContain("{isPlatformSite && <AnalyticsConsentControl />}");
    expect(control).toContain('import { usePathname, useSearchParams } from "next/navigation"');
    expect(control).toContain("const pathname = usePathname()");
    expect(control).toContain("const searchParams = useSearchParams()");
    expect(control).toContain('const queryLanguage = searchParams.get("lang")');
    expect(control).toContain('pathname === "/en" || pathname?.startsWith("/en/")');
    expect(control).toContain('document.querySelector<HTMLElement>("main[lang]")');
    expect(control).toContain('if (pathname) return "sv";');
    expect(control).toContain("document.documentElement.lang");
    expect(control).toContain("new MutationObserver");
    expect(control).toContain("}, [pathname, queryLanguage]);");
    expect(guestQuote).toContain("<main lang={locale}");
    expect(booking).toContain("query?.lang");
    expect(offer).toContain("query?.lang");
    expect(control).toContain("Analytics settings");
    expect(control).toContain("Reject analytics");
    expect(control).toContain("Allow analytics");
    expect(control).toContain("Nothing is sent before you choose to allow analytics.");
  });

  it("exposes the resolved booking locale for English-default and Swedish booking pages", () => {
    const booking = source("src/app/boka/[slug]/page.tsx");
    const control = source("src/components/analytics/analytics-consent-control.tsx");

    expect(booking).toContain(': experience.defaultLanguage;');
    expect(booking).toContain('requestedLanguage === "en" && experience.englishEnabled ? "en"');
    expect(booking).toContain('requestedLanguage === "sv" && experience.swedishEnabled ? "sv"');
    expect(booking.match(/<main lang=\{locale\}/g)).toHaveLength(2);
    expect(control).toContain('document.querySelector<HTMLElement>("main[lang]")');
  });

  it("exposes PrimeView's default and explicit booking locale on the route root", () => {
    const primeView = source("src/app/boka/primeview/page.tsx");
    const booking = source("src/app/boka/[slug]/page.tsx");

    expect(primeView).toContain('const locale: Locale = first(query?.lang) === "sv" ? "sv" : "en";');
    expect(primeView).toContain('<main lang={locale} className="min-h-screen');
    expect(primeView).toContain('href="/boka/primeview?lang=en"');
    expect(primeView).toContain('href="/boka/primeview?lang=sv"');

    expect(booking).toContain('firstParam(query?.lang) === "en" ? "en"');
    expect(booking).toContain('firstParam(query?.lang) === "sv" ? "sv"');
    expect(booking).toContain(': experience.defaultLanguage;');
    expect(booking).toContain('requestedLanguage === "sv" && experience.swedishEnabled ? "sv"');
    expect(booking.match(/<main lang=\{locale\}/g)).toHaveLength(2);
  });

  it("classifies legitimate country-specific Google referrers without broad hostname matching", () => {
    expect(analyticsSourceFromReferrer("https://www.google.se/search?q=proffera")).toBe("google");
    expect(analyticsSourceFromReferrer("https://www.google.co.uk/search?q=proffera")).toBe("google");
    expect(analyticsSourceFromReferrer("https://maps.google.com/maps?q=proffera")).toBe("google");
    expect(analyticsSourceFromReferrer("https://google.example.com/search?q=proffera")).toBe("external");
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
