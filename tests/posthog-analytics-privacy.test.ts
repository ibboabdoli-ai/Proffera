import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentFromStoredValue,
  analyticsSourceFromReferrer,
  isAnalyticsConsentGranted,
  persistAnalyticsConsent,
  readAnalyticsConsent,
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

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  };
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

  it("keeps unknown consent disabled and does not load the SDK before explicit consent", () => {
    expect(analyticsConsentFromStoredValue(null)).toBe("unknown");
    expect(analyticsConsentFromStoredValue("anything-else")).toBe("unknown");
    expect(isAnalyticsConsentGranted("unknown")).toBe(false);

    const client = source("src/components/analytics/posthog-analytics.tsx");
    const consentGuard = client.indexOf("if (!isAnalyticsConsentGranted(consent)) return;");
    const sdkLoad = client.indexOf("void loadPostHog(config)");

    expect(consentGuard).toBeGreaterThan(-1);
    expect(sdkLoad).toBeGreaterThan(-1);
    expect(consentGuard).toBeLessThan(sdkLoad);
  });

  it("persists accept, dispatches the consent change, and enables analytics without reload", () => {
    const { storage, values } = memoryStorage();
    const notifications: string[] = [];

    expect(
      persistAnalyticsConsent(storage, "granted", () => {
        notifications.push(ANALYTICS_CONSENT_CHANGED_EVENT);
      }),
    ).toBe(true);
    expect(values.get(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(readAnalyticsConsent(storage)).toBe("granted");
    expect(isAnalyticsConsentGranted(readAnalyticsConsent(storage))).toBe(true);
    expect(notifications).toEqual([ANALYTICS_CONSENT_CHANGED_EVENT]);

    const control = source("src/components/analytics/analytics-consent-control.tsx");
    const client = source("src/components/analytics/posthog-analytics.tsx");
    expect(control).toContain('chooseConsent("granted")');
    expect(control).toContain("window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT))");
    expect(client.indexOf("void loadPostHog(config)")).toBeLessThan(
      client.indexOf("if (!shouldCapturePageview(lastCapturedPageKey, pageKey)) return;"),
    );
  });

  it("persists reject and keeps analytics disabled", () => {
    const { storage, values } = memoryStorage();
    let notifications = 0;

    expect(persistAnalyticsConsent(storage, "denied", () => notifications += 1)).toBe(true);
    expect(values.get(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(readAnalyticsConsent(storage)).toBe("denied");
    expect(isAnalyticsConsentGranted(readAnalyticsConsent(storage))).toBe(false);
    expect(notifications).toBe(1);

    const control = source("src/components/analytics/analytics-consent-control.tsx");
    expect(control).toContain('chooseConsent("denied")');
    expect(control).toContain("Avvisa analys");
    expect(control).toContain("Tillåt analys");
  });

  it("revokes a previous grant and opts PostHog out immediately", () => {
    const { storage } = memoryStorage();
    let notifications = 0;

    expect(persistAnalyticsConsent(storage, "granted", () => notifications += 1)).toBe(true);
    expect(readAnalyticsConsent(storage)).toBe("granted");
    expect(persistAnalyticsConsent(storage, "denied", () => notifications += 1)).toBe(true);
    expect(readAnalyticsConsent(storage)).toBe("denied");
    expect(isAnalyticsConsentGranted(readAnalyticsConsent(storage))).toBe(false);
    expect(notifications).toBe(2);

    const client = source("src/components/analytics/posthog-analytics.tsx");
    expect(client).toContain('if (consent === "denied")');
    expect(client).toContain("lastCapturedPageKey = null;");
    expect(client).toContain("posthog?.opt_out_capturing()");
  });

  it("keeps persisted consent across client-side navigation", () => {
    const { storage, values } = memoryStorage({ [ANALYTICS_CONSENT_STORAGE_KEY]: "granted" });
    const first = "production:https://proffera.se/tjanster/bokningssystem";
    const second = "production:https://proffera.se/foretag";

    expect(readAnalyticsConsent(storage)).toBe("granted");
    expect(shouldCapturePageview(null, first)).toBe(true);
    expect(shouldCapturePageview(first, first)).toBe(false);
    expect(shouldCapturePageview(first, second)).toBe(true);
    expect(values.get(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(readAnalyticsConsent(storage)).toBe("granted");
  });

  it("provides a neutral user-facing way to set and later change analytics consent", () => {
    const layout = source("src/app/layout.tsx");
    const control = source("src/components/analytics/analytics-consent-control.tsx");

    expect(layout).toContain("{isPlatformSite && <AnalyticsConsentControl />}");
    expect(control).toContain("Analysinställningar");
    expect(control).toContain("Inget skickas innan");
    expect(control).toContain("reklamspårning");
    expect(control).not.toContain("defaultChecked");
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

  it("redacts realistic signed dot-delimited customer portal tokens and still strips query/fragment data", () => {
    const portalToken =
      "eyJ3b3Jrc3BhY2VJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsImN1c3RvbWVySWQiOiJjdXN0b21lcl8xMjM0NTY3ODkwIiwiZXhwIjoxODAwMDAwMDAwfQ.Dw7msDnzPD5GGV2AyXdzh7kIninShmDBoISmXAXLr8Q";
    const rawPath = `/mina-bokningar/${portalToken}?booking=550e8400-e29b-41d4-a716-446655440000#private`;

    expect(sanitizeAnalyticsPathname(rawPath)).toBe("/mina-bokningar/:redacted");
    expect(sanitizePageUrl("https://www.proffera.se", rawPath)).toBe(
      "https://www.proffera.se/mina-bokningar/:redacted",
    );

    const event = sanitizePostHogEvent({
      event: "$pageview",
      properties: {
        $current_url: `https://www.proffera.se${rawPath}`,
        $pathname: rawPath,
        proffera_environment: "production",
      },
    });

    expect(event?.properties?.$current_url).toBe("https://www.proffera.se/mina-bokningar/:redacted");
    expect(event?.properties?.$pathname).toBe("/mina-bokningar/:redacted");
    expect(JSON.stringify(event)).not.toContain(portalToken);
    expect(String(event?.properties?.$current_url)).not.toContain("?");
    expect(String(event?.properties?.$current_url)).not.toContain("#");
    expect(String(event?.properties?.$pathname)).not.toContain("?");
    expect(String(event?.properties?.$pathname)).not.toContain("#");
  });

  it("preserves personnummer, organisation-number, internal-ID, UUID, token and email redaction", () => {
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
