import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyticsConsentFromStoredValue,
  analyticsSourceFromReferrer,
  isAnalyticsConsentGranted,
  resolvePostHogConfig,
  sanitizeAnalyticsPathname,
  sanitizePageUrl,
  sanitizePostHogEvent,
  shouldCapturePageview,
} from "../src/lib/analytics/posthog-privacy";
import { isAnalyticsPlatformHost } from "../src/lib/public-site-domains";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PostHog privacy-safe analytics", () => {
  it("fails closed when configuration is absent or belongs to the wrong environment", () => {
    expect(resolvePostHogConfig({ VERCEL_ENV: "production" })).toBeNull();
    expect(resolvePostHogConfig({ VERCEL_ENV: "preview" })).toBeNull();
    expect(resolvePostHogConfig({ VERCEL_ENV: "development" })).toBeNull();

    expect(resolvePostHogConfig({
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_prod",
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
    })).toBeNull();

    expect(resolvePostHogConfig({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_prod",
      NEXT_PUBLIC_POSTHOG_HOST: "http://eu.i.posthog.com",
    })).toBeNull();
  });

  it("stays disabled until analytics consent is explicitly granted", () => {
    expect(analyticsConsentFromStoredValue(null)).toBe("unknown");
    expect(analyticsConsentFromStoredValue("anything-else")).toBe("unknown");
    expect(analyticsConsentFromStoredValue("denied")).toBe("denied");
    expect(isAnalyticsConsentGranted("unknown")).toBe(false);
    expect(isAnalyticsConsentGranted("denied")).toBe(false);
    expect(isAnalyticsConsentGranted("granted")).toBe(true);

    const client = source("src/components/analytics/posthog-analytics.tsx");
    expect(client).toContain("if (!isAnalyticsConsentGranted(consent)) return;");
    expect(client.indexOf("if (!isAnalyticsConsentGranted(consent)) return;")).toBeLessThan(
      client.indexOf("void loadPostHog(config)"),
    );
  });

  it("limits analytics to intended Proffera Production and Preview hosts", () => {
    expect(isAnalyticsPlatformHost("proffera.se", "production")).toBe(true);
    expect(isAnalyticsPlatformHost("www.proffera.se", "production")).toBe(true);
    expect(isAnalyticsPlatformHost("chat.proffera.se", "production")).toBe(true);
    expect(isAnalyticsPlatformHost("proffera-git-feature-example.vercel.app", "preview")).toBe(true);

    expect(isAnalyticsPlatformHost("primeviewwindowcare.co.uk", "production")).toBe(false);
    expect(isAnalyticsPlatformHost("www.primeviewwindowcare.co.uk", "production")).toBe(false);
    expect(isAnalyticsPlatformHost("customer.example.com", "production")).toBe(false);
    expect(isAnalyticsPlatformHost("customer.example.com", "preview")).toBe(false);
    expect(isAnalyticsPlatformHost("proffera.se", "preview")).toBe(false);
    expect(isAnalyticsPlatformHost("proffera-git-feature-example.vercel.app", "production")).toBe(false);
  });

  it("captures at most one pageview per navigation and captures route changes", () => {
    const first = "production:https://proffera.se/tjanster/bokningssystem";
    const second = "production:https://proffera.se/foretag";

    expect(shouldCapturePageview(null, first)).toBe(true);
    expect(shouldCapturePageview(first, first)).toBe(false);
    expect(shouldCapturePageview(first, second)).toBe(true);
    expect(shouldCapturePageview(second, second)).toBe(false);
  });

  it("strips query strings and fragments from page URLs", () => {
    expect(sanitizeAnalyticsPathname("/foretag?email=person@example.com#private")).toBe("/foretag");
    expect(sanitizePageUrl("https://www.proffera.se", "/foretag?token=secret#private")).toBe(
      "https://www.proffera.se/foretag",
    );

    const event = sanitizePostHogEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://www.proffera.se/foretag?email=person@example.com#private",
        $pathname: "/foretag?token=secret#private",
        proffera_environment: "production",
      },
    });

    expect(event?.properties?.$current_url).toBe("https://www.proffera.se/foretag");
    expect(event?.properties?.$pathname).toBe("/foretag");
  });

  it("redacts personnummer, organisation numbers, internal IDs, UUIDs, tokens and emails", () => {
    expect(sanitizeAnalyticsPathname("/person/198901011234")).toBe("/person/:redacted");
    expect(sanitizeAnalyticsPathname("/company/5592643778")).toBe("/company/:redacted");
    expect(sanitizeAnalyticsPathname("/lead/1234567")).toBe("/lead/:redacted");
    expect(sanitizeAnalyticsPathname("/booking/550e8400-e29b-41d4-a716-446655440000")).toBe(
      "/booking/:redacted",
    );
    expect(sanitizeAnalyticsPathname("/review/abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "/review/:redacted",
    );
    expect(sanitizeAnalyticsPathname("/user/person@example.com")).toBe("/user/:redacted");
    expect(sanitizeAnalyticsPathname("/foretag/normal-company-slug")).toBe(
      "/foretag/normal-company-slug",
    );
  });

  it("never forwards a raw referrer or arbitrary event properties", () => {
    expect(analyticsSourceFromReferrer("https://www.google.com/search?q=private+search")).toBe("google");
    expect(analyticsSourceFromReferrer("https://unknown.example/private?token=secret")).toBe("external");

    const event = sanitizePostHogEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://proffera.se/foretag",
        $pathname: "/foretag",
        proffera_environment: "production",
        source: "google",
        $referrer: "https://www.google.com/search?q=private+search",
        $referring_domain: "google.com",
        email: "person@example.com",
        name: "Private Person",
        phone: "+46700000000",
        search_text: "sensitive query",
        workspace_id: "550e8400-e29b-41d4-a716-446655440000",
      },
    });

    expect(event?.properties).toEqual({
      $current_url: "https://proffera.se/foretag",
      $pathname: "/foretag",
      proffera_environment: "production",
      source: "google",
      $process_person_profile: false,
    });
    expect(JSON.stringify(event)).not.toContain("private+search");
    expect(JSON.stringify(event)).not.toContain("person@example.com");
    expect(JSON.stringify(event)).not.toContain("Private Person");
    expect(JSON.stringify(event)).not.toContain("sensitive query");
  });

  it("allows only manual $pageview events through the final send boundary", () => {
    expect(sanitizePostHogEvent({ event: "$autocapture", properties: {} })).toBeNull();
    expect(sanitizePostHogEvent({ event: "$identify", properties: {} })).toBeNull();
    expect(sanitizePostHogEvent({ event: "$exception", properties: {} })).toBeNull();
    expect(sanitizePostHogEvent({ event: "booking_submitted", properties: {} })).toBeNull();
    expect(sanitizePostHogEvent({ event: "$pageview", properties: {} })?.event).toBe("$pageview");
  });

  it("keeps PostHog collection features disabled outside the intended pageview slice", () => {
    const client = source("src/components/analytics/posthog-analytics.tsx");

    expect(client).toContain("autocapture: false");
    expect(client).toContain("capture_pageview: false");
    expect(client).toContain("capture_pageleave: false");
    expect(client).toContain("capture_performance: false");
    expect(client).toContain("disable_session_recording: true");
    expect(client).toContain('person_profiles: "never"');
    expect(client).toContain("ip: false");
    expect(client).toContain("advanced_disable_flags: true");
    expect(client).toContain("advanced_disable_toolbar_metrics: true");
    expect(client).toContain("before_send: sanitizePostHogEvent");
    expect(client).not.toContain(".identify(");
  });

  it("leaves the existing WebVitals reporter and endpoint behavior independent", () => {
    const layout = source("src/app/layout.tsx");
    const reporter = source("src/components/performance/web-vitals-reporter.tsx");
    const endpointTests = source("tests/web-vitals-route.test.ts");

    expect(layout).toContain("{isPlatformSite && <WebVitalsReporter />}");
    expect(reporter).toContain("useReportWebVitals(sendMetric)");
    expect(reporter).toContain('fetch("/api/observability/web-vitals"');
    expect(reporter).not.toContain("posthog");
    expect(endpointTests).toContain('describe("web vitals baseline"');
  });
});
