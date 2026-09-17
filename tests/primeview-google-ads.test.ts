import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID,
  PRIMEVIEW_GOOGLE_ADS_TAG_ID,
  buildPrimeViewGoogleAdsPageLocation,
  googleAdsConsentCommand,
  isPrimeViewBookingConversionPath,
} from "../src/lib/analytics/google-ads";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PrimeView Google Ads measurement", () => {
  it("recognizes only the booked PrimeView booking URL as the conversion page", () => {
    expect(isPrimeViewBookingConversionPath("/booking", null)).toBe(false);
    expect(isPrimeViewBookingConversionPath("/booking", "0")).toBe(false);
    expect(isPrimeViewBookingConversionPath("/booking", "1")).toBe(true);
    expect(isPrimeViewBookingConversionPath("/", "1")).toBe(false);
    expect(isPrimeViewBookingConversionPath("/services/window-cleaning", "1")).toBe(false);
  });

  it("keeps only the conversion marker in the Google Ads page location", () => {
    expect(buildPrimeViewGoogleAdsPageLocation(
      "https://www.primeviewwindowcare.co.uk",
      "/booking",
      null,
    )).toBe("https://www.primeviewwindowcare.co.uk/booking");

    expect(buildPrimeViewGoogleAdsPageLocation(
      "https://www.primeviewwindowcare.co.uk",
      "/booking",
      "1",
    )).toBe("https://www.primeviewwindowcare.co.uk/booking?booked=1");

    expect(buildPrimeViewGoogleAdsPageLocation(
      "https://www.primeviewwindowcare.co.uk",
      "/services/window-cleaning",
      "1",
    )).toBe("https://www.primeviewwindowcare.co.uk/services/window-cleaning");
  });

  it("uses EEA consent fields and keeps ad personalization disabled", () => {
    expect(googleAdsConsentCommand("denied")).toEqual({
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    expect(googleAdsConsentCommand("granted")).toEqual({
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "denied",
    });
  });

  it("renders the Ads integration only for the PrimeView host branch", () => {
    const layout = source("src/app/layout.tsx");
    expect(layout).toContain('import { PrimeViewGoogleAds } from "@/components/analytics/primeview-google-ads"');
    expect(layout).toContain("{isCustomerSite && <PrimeViewGoogleAds />}");
    expect(layout).toContain("const isCustomerSite = isPrimeViewHost(host)");
  });

  it("loads one Google tag only after consent and reuses the existing consent state", () => {
    const component = source("src/components/analytics/primeview-google-ads.tsx");

    expect(PRIMEVIEW_GOOGLE_ADS_TAG_ID).toBe("AW-18438705476");
    expect(PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID).toBe("primeview-google-ads-tag");
    expect(component).toContain("readAnalyticsConsent(window.localStorage)");
    expect(component).toContain("ANALYTICS_CONSENT_CHANGED_EVENT");
    expect(component).toContain('if (consent !== "granted")');
    expect(component).toContain("document.getElementById(PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID)");
    expect(component).toContain("googleAdsScriptPromise");
    expect(component).toContain("initializeGoogleAds()");
  });

  it("does not send a manual conversion event or PII fields", () => {
    const component = source("src/components/analytics/primeview-google-ads.tsx");

    expect(component).not.toContain('"conversion"');
    expect(component).not.toContain("conversion_label");
    expect(component).not.toContain("enhanced_conversions");
    expect(component).not.toContain("user_data");
    expect(component).not.toContain("email:");
    expect(component).not.toContain("phone:");
    expect(component).not.toContain("name:");
    expect(component).toContain("page_location: pageLocation");
  });
});
