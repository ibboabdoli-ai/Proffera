"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  isAnalyticsConsentGranted,
  readAnalyticsConsent,
  type AnalyticsConsentState,
} from "@/lib/analytics/posthog-privacy";
import {
  PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID,
  PRIMEVIEW_GOOGLE_ADS_TAG_ID,
  buildPrimeViewGoogleAdsPageView,
} from "@/lib/analytics/google-ads";
import { isPrimeViewHost } from "@/lib/public-site-domains";

type GoogleTagFunction = (...args: unknown[]) => void;
type GoogleAdsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: GoogleTagFunction;
};

let consentDefaultQueued = false;
let googleTagJsQueued = false;
let googleTagConfigured = false;
let lastSentPageKey: string | null = null;

function currentConsent(): AnalyticsConsentState {
  return readAnalyticsConsent(window.localStorage);
}

function ensureGoogleTagQueue() {
  const googleWindow = window as GoogleAdsWindow;
  googleWindow.dataLayer ??= [];

  if (!googleWindow.gtag) {
    googleWindow.gtag = function gtag() {
      googleWindow.dataLayer?.push(arguments);
    };
  }

  return googleWindow.gtag;
}

function queueDefaultConsent() {
  if (consentDefaultQueued) return;

  ensureGoogleTagQueue()("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
  consentDefaultQueued = true;
}

function queueConsentUpdate(consent: AnalyticsConsentState) {
  if (consent === "unknown") return;

  const measurementConsent = consent === "granted" ? "granted" : "denied";
  ensureGoogleTagQueue()("consent", "update", {
    ad_storage: measurementConsent,
    analytics_storage: measurementConsent,
    // PrimeView uses the tag for conversion measurement only. No enhanced
    // conversions, user-provided data, or ads-personalization signal is enabled.
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

function ensureGoogleTagScript() {
  if (document.getElementById(PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID)) return;

  // Reuse any Google tag already present at runtime instead of adding another
  // gtag.js instance. The repository itself does not install another Google tag.
  const existingGoogleTag = document.querySelector<HTMLScriptElement>(
    'script[src^="https://www.googletagmanager.com/gtag/js"]',
  );
  if (existingGoogleTag) return;

  const script = document.createElement("script");
  script.id = PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(PRIMEVIEW_GOOGLE_ADS_TAG_ID)}`;
  document.head.appendChild(script);
}

function configureGoogleTag() {
  const gtag = ensureGoogleTagQueue();

  if (!googleTagJsQueued) {
    gtag("js", new Date());
    googleTagJsQueued = true;
  }

  if (!googleTagConfigured) {
    // Disable the implicit page view so every URL sent to Google is constructed
    // below. This prevents arbitrary query parameters from leaking to Ads.
    gtag("config", PRIMEVIEW_GOOGLE_ADS_TAG_ID, { send_page_view: false });
    googleTagConfigured = true;
  }

  ensureGoogleTagScript();
}

export function PrimeViewGoogleAdsAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [consent, setConsent] = useState<AnalyticsConsentState>(() =>
    typeof window === "undefined" ? "unknown" : currentConsent(),
  );

  useEffect(() => {
    if (!isPrimeViewHost(window.location.host)) return;

    queueDefaultConsent();

    const syncConsent = () => setConsent(currentConsent());
    const syncConsentFromStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      syncConsent();
    };

    syncConsent();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
    window.addEventListener("storage", syncConsentFromStorage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
      window.removeEventListener("storage", syncConsentFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!isPrimeViewHost(window.location.host)) return;

    queueDefaultConsent();

    if (!isAnalyticsConsentGranted(consent)) {
      if (consent === "denied") queueConsentUpdate("denied");
      lastSentPageKey = null;
      return;
    }

    queueConsentUpdate("granted");
    configureGoogleTag();

    const pageView = buildPrimeViewGoogleAdsPageView(
      window.location.origin,
      pathname || window.location.pathname,
      new URLSearchParams(search),
    );
    if (!pageView || lastSentPageKey === pageView.pageLocation) return;

    // The Google Ads conversion action is intentionally URL/page-load based.
    // Only a verified /booking?booked=1 page view retains that query marker;
    // normal /booking visits never receive it and no second conversion event is
    // emitted here, avoiding duplicate direct-tag conversion firing.
    ensureGoogleTagQueue()("event", "page_view", {
      send_to: PRIMEVIEW_GOOGLE_ADS_TAG_ID,
      page_location: pageView.pageLocation,
      page_path: pageView.pagePath,
    });
    lastSentPageKey = pageView.pageLocation;
  }, [consent, pathname, search]);

  return null;
}
