import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  sanitizeAnalyticsPathname,
} from "../src/lib/analytics/posthog-privacy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PostHog final review regressions", () => {
  it("preserves canonical public directory slugs on the actual Swedish and English routes", () => {
    const publicSlug = "example-elektriska-ab-115707";

    expect(sanitizeAnalyticsPathname(`/foretag/listad/${publicSlug}`)).toBe(
      `/foretag/listad/${publicSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/en/companies/${publicSlug}`)).toBe(
      `/en/companies/${publicSlug}`,
    );
    expect(sanitizeAnalyticsPathname(`/review/${publicSlug}`)).toBe("/review/:redacted");
  });

  it("synchronizes analytics consent changes across open tabs", () => {
    const client = source("src/components/analytics/posthog-analytics.tsx");
    const control = source("src/components/analytics/analytics-consent-control.tsx");

    expect(client).toContain(ANALYTICS_CONSENT_STORAGE_KEY);
    expect(client).toContain("event.key !== ANALYTICS_CONSENT_STORAGE_KEY");
    expect(client).toContain('window.addEventListener("storage", handleStorageChange)');
    expect(client).toContain("posthog?.opt_out_capturing()");
    expect(control).toContain('window.addEventListener("storage", syncConsentFromStorage)');
  });

  it("localizes the neutral consent control for English public pages", () => {
    const layout = source("src/app/layout.tsx");
    const control = source("src/components/analytics/analytics-consent-control.tsx");

    expect(layout).toContain(
      '<AnalyticsConsentControl locale={isEnglishPublicSite ? "en" : "sv"} />',
    );
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
