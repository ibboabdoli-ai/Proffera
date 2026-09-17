"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  readAnalyticsConsent,
  type AnalyticsConsentState,
} from "@/lib/analytics/posthog-privacy";
import {
  createPrimeViewGoogleAdsRuntime,
  type GoogleTagFunction,
} from "@/lib/analytics/primeview-google-ads-runtime";
import { isPrimeViewHost } from "@/lib/public-site-domains";

type GoogleAdsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: GoogleTagFunction;
};

const googleAdsRuntime = createPrimeViewGoogleAdsRuntime();

/** Returns the persisted analytics consent used by both PostHog and PrimeView Ads measurement. */
function currentConsent(): AnalyticsConsentState {
  return readAnalyticsConsent(window.localStorage);
}

/** Reuses the page-level Google queue instead of creating another gtag instance. */
function ensureGoogleTagQueue(): GoogleTagFunction {
  const googleWindow = window as GoogleAdsWindow;
  googleWindow.dataLayer ??= [];

  const gtag: GoogleTagFunction = googleWindow.gtag ?? ((...args: unknown[]) => {
    googleWindow.dataLayer?.push(args);
  });
  googleWindow.gtag = gtag;

  return gtag;
}

/** Bridges PrimeView navigation and the shared consent state into the isolated Ads runtime. */
export function PrimeViewGoogleAdsAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [consent, setConsent] = useState<AnalyticsConsentState>(() =>
    typeof window === "undefined" ? "unknown" : currentConsent(),
  );

  useEffect(() => {
    if (!isPrimeViewHost(window.location.host)) return;

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

    googleAdsRuntime.sync({
      consent,
      host: window.location.host,
      origin: window.location.origin,
      pathname: pathname || window.location.pathname,
      searchParams: new URLSearchParams(search),
      gtag: ensureGoogleTagQueue(),
      hasScriptById: (id) => document.getElementById(id) !== null,
      hasAnyGoogleTagScript: () =>
        document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]') !== null,
      appendScript: ({ id, async, src }) => {
        const script = document.createElement("script");
        script.id = id;
        script.async = async;
        script.src = src;
        document.head.appendChild(script);
      },
    });
  }, [consent, pathname, search]);

  return null;
}
