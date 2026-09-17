import type { AnalyticsConsentState } from "./posthog-privacy";
import { isAnalyticsConsentGranted } from "./posthog-privacy";
import {
  PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID,
  PRIMEVIEW_GOOGLE_ADS_TAG_ID,
  buildPrimeViewGoogleAdsPageView,
} from "./google-ads";
import { isPrimeViewHost } from "../public-site-domains";

type SearchParamsLike = Pick<URLSearchParams, "get">;

export type GoogleTagFunction = (...args: unknown[]) => void;

export type PrimeViewGoogleAdsRuntimeInput = {
  consent: AnalyticsConsentState;
  host: string;
  origin: string;
  pathname: string;
  searchParams: SearchParamsLike;
  gtag: GoogleTagFunction;
  hasScriptById: (id: string) => boolean;
  hasAnyGoogleTagScript: () => boolean;
  appendScript: (script: { id: string; async: boolean; src: string }) => void;
};

export type PrimeViewGoogleAdsRuntime = {
  sync: (input: PrimeViewGoogleAdsRuntimeInput) => void;
};

/**
 * Creates an isolated stateful runtime for PrimeView Google Ads measurement.
 * The browser component owns one instance; tests can create fresh instances and
 * exercise the same consent, script, sanitization, and deduplication behavior.
 */
export function createPrimeViewGoogleAdsRuntime(): PrimeViewGoogleAdsRuntime {
  let consentDefaultQueued = false;
  let googleTagJsQueued = false;
  let googleTagConfigured = false;
  let lastSentPageKey: string | null = null;

  function queueDefaultConsent(gtag: GoogleTagFunction) {
    if (consentDefaultQueued) return;

    gtag("consent", "default", {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500,
    });
    consentDefaultQueued = true;
  }

  function queueConsentUpdate(gtag: GoogleTagFunction, consent: AnalyticsConsentState) {
    if (consent === "unknown") return;

    const measurementConsent = consent === "granted" ? "granted" : "denied";
    gtag("consent", "update", {
      ad_storage: measurementConsent,
      analytics_storage: measurementConsent,
      // Consent Mode signal only. PrimeView does not supply user_data or
      // enhanced-conversion form fields to this integration.
      ad_user_data: measurementConsent,
      ad_personalization: "denied",
    });
  }

  function ensureGoogleTagScript(input: PrimeViewGoogleAdsRuntimeInput) {
    if (input.hasScriptById(PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID) || input.hasAnyGoogleTagScript()) return;

    input.appendScript({
      id: PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID,
      async: true,
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(PRIMEVIEW_GOOGLE_ADS_TAG_ID)}`,
    });
  }

  function configureGoogleTag(input: PrimeViewGoogleAdsRuntimeInput) {
    if (!googleTagJsQueued) {
      input.gtag("js", new Date());
      googleTagJsQueued = true;
    }

    if (!googleTagConfigured) {
      input.gtag("config", PRIMEVIEW_GOOGLE_ADS_TAG_ID, {
        send_page_view: false,
        allow_ad_personalization_signals: false,
      });
      googleTagConfigured = true;
    }

    ensureGoogleTagScript(input);
  }

  return {
    sync(input) {
      if (!isPrimeViewHost(input.host)) return;

      queueDefaultConsent(input.gtag);

      if (!isAnalyticsConsentGranted(input.consent)) {
        if (input.consent === "denied") queueConsentUpdate(input.gtag, "denied");
        lastSentPageKey = null;
        return;
      }

      queueConsentUpdate(input.gtag, "granted");
      configureGoogleTag(input);

      const pageView = buildPrimeViewGoogleAdsPageView(
        input.origin,
        input.pathname,
        input.searchParams,
      );
      if (!pageView || lastSentPageKey === pageView.pageLocation) return;

      input.gtag("event", "page_view", {
        send_to: PRIMEVIEW_GOOGLE_ADS_TAG_ID,
        page_location: pageView.pageLocation,
        page_path: pageView.pagePath,
        page_referrer: "",
      });
      lastSentPageKey = pageView.pageLocation;
    },
  };
}
