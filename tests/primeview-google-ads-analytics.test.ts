import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PRIMEVIEW_GOOGLE_ADS_TAG_ID,
  buildPrimeViewGoogleAdsPageView,
  isPrimeViewBookingConversionPage,
} from "../src/lib/analytics/google-ads";
import { isPrimeViewHost } from "../src/lib/public-site-domains";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PrimeView Google Ads conversion measurement", () => {
  it("keeps normal booking visits distinct from the booked=1 success URL", () => {
    const normalParams = new URLSearchParams("");
    const successParams = new URLSearchParams("booked=1");

    expect(isPrimeViewBookingConversionPage("/booking", normalParams)).toBe(false);
    expect(isPrimeViewBookingConversionPage("/booking", successParams)).toBe(true);

    expect(
      buildPrimeViewGoogleAdsPageView(
        "https://www.primeviewwindowcare.co.uk",
        "/booking",
        normalParams,
      ),
    ).toEqual({
      pageLocation: "https://www.primeviewwindowcare.co.uk/booking",
      pagePath: "/booking",
      isBookingConversion: false,
    });

    expect(
      buildPrimeViewGoogleAdsPageView(
        "https://www.primeviewwindowcare.co.uk",
        "/booking",
        successParams,
      ),
    ).toEqual({
      pageLocation: "https://www.primeviewwindowcare.co.uk/booking?booked=1",
      pagePath: "/booking?booked=1",
      isBookingConversion: true,
    });
  });

  it("strips arbitrary query data and sensitive path identifiers before sending a page view", () => {
    const successWithPii = buildPrimeViewGoogleAdsPageView(
      "https://www.primeviewwindowcare.co.uk",
      "/booking",
      new URLSearchParams("booked=1&email=person%40example.com&phone=07123456789"),
    );
    expect(successWithPii?.pageLocation).toBe(
      "https://www.primeviewwindowcare.co.uk/booking?booked=1",
    );
    expect(JSON.stringify(successWithPii)).not.toContain("person@example.com");
    expect(JSON.stringify(successWithPii)).not.toContain("07123456789");

    const verification = buildPrimeViewGoogleAdsPageView(
      "https://www.primeviewwindowcare.co.uk",
      "/boka/verifiera/550e8400-e29b-41d4-a716-446655440000",
      new URLSearchParams("code=123456"),
    );
    expect(verification?.pageLocation).toBe(
      "https://www.primeviewwindowcare.co.uk/boka/verifiera/:redacted",
    );
    expect(JSON.stringify(verification)).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(JSON.stringify(verification)).not.toContain("123456");
  });

  it("scopes the Ads integration to the two PrimeView production hosts", () => {
    expect(isPrimeViewHost("primeviewwindowcare.co.uk")).toBe(true);
    expect(isPrimeViewHost("www.primeviewwindowcare.co.uk")).toBe(true);
    expect(isPrimeViewHost("proffera.se")).toBe(false);
    expect(isPrimeViewHost("customer.example.com")).toBe(false);

    const layout = source("src/app/layout.tsx");
    expect(layout).toContain('{isCustomerSite && <AnalyticsConsentControl brand="primeview" />}');
    expect(layout).toContain("{isCustomerSite && <PrimeViewGoogleAdsAnalytics />}");
    expect(layout).toContain("{shouldRenderAnalytics && <PostHogAnalytics config={postHogConfig} />}");
  });

  it("uses consent mode defaults and never loads gtag.js before analytics consent is granted", () => {
    const client = source("src/components/analytics/primeview-google-ads-analytics.tsx");

    expect(PRIMEVIEW_GOOGLE_ADS_TAG_ID).toBe("AW-18438705476");
    expect(client).toContain('ad_storage: "denied"');
    expect(client).toContain('analytics_storage: "denied"');
    expect(client).toContain('ad_user_data: "denied"');
    expect(client).toContain('ad_personalization: "denied"');
    expect(client).toContain('if (!isAnalyticsConsentGranted(consent))');
    expect(client).toContain('queueConsentUpdate("granted")');
    expect(client).toContain("configureGoogleTag();");
    expect(client.indexOf('if (!isAnalyticsConsentGranted(consent))')).toBeLessThan(
      client.lastIndexOf("configureGoogleTag();"),
    );
    expect(client).toContain("document.createElement(\"script\")");
    expect(client).toContain("https://www.googletagmanager.com/gtag/js?id=");
  });

  it("prevents duplicate tag/page firing and relies on the single URL-based Ads conversion", () => {
    const client = source("src/components/analytics/primeview-google-ads-analytics.tsx");

    expect(client).toContain("document.getElementById(PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID)");
    expect(client).toContain('script[src^="https://www.googletagmanager.com/gtag/js"]');
    expect(client).toContain("send_page_view: false");
    expect(client).toContain("lastSentPageKey === pageView.pageLocation");
    expect(client).toContain('ensureGoogleTagQueue()("event", "page_view"');
    expect(client).toContain('page_referrer: ""');
    expect(client).not.toContain('"event", "conversion"');
  });

  it("updates PrimeView consent copy and privacy disclosure without changing the booking flow", () => {
    const consent = source("src/components/analytics/analytics-consent-control.tsx");
    const privacy = source("src/app/privacy/page.tsx");
    const bookingVerifier = source("src/app/boka/verifiera/[id]/page.tsx");

    expect(consent).toContain("The Google tag is not loaded until you allow this.");
    expect(consent).toContain("We do not send booking form text, names, email addresses or phone numbers.");
    expect(privacy).toContain("Optional Google Ads measurement is disabled by default.");
    expect(bookingVerifier).toContain('if (result.slug === "primeview") redirect("/booking?booked=1")');
  });
});
