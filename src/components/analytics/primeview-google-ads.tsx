"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  persistAnalyticsConsent,
  readAnalyticsConsent,
  type AnalyticsConsentState,
  type PersistedAnalyticsConsentState,
} from "@/lib/analytics/posthog-privacy";
import {
  PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID,
  PRIMEVIEW_GOOGLE_ADS_TAG_ID,
  buildPrimeViewGoogleAdsPageLocation,
  googleAdsConsentCommand,
} from "@/lib/analytics/google-ads";

type DataLayerEntry = IArguments | unknown[];
type GoogleTagWindow = Window & {
  dataLayer?: DataLayerEntry[];
  gtag?: (...args: unknown[]) => void;
};

let googleAdsInitialized = false;
let googleAdsScriptPromise: Promise<void> | null = null;
let lastPageLocation: string | null = null;

function getGoogleTag() {
  const target = window as GoogleTagWindow;
  target.dataLayer ??= [];
  target.gtag ??= function gtag() {
    target.dataLayer?.push(arguments);
  };
  return target.gtag;
}

function setDefaultDeniedConsent() {
  const gtag = getGoogleTag();
  gtag("consent", "default", {
    ...googleAdsConsentCommand("denied"),
    wait_for_update: 500,
  });
  gtag("set", "allow_ad_personalization_signals", false);
}

function updateGoogleAdsConsent(consent: "granted" | "denied") {
  getGoogleTag()("consent", "update", googleAdsConsentCommand(consent));
}

function loadGoogleAdsScript() {
  if (googleAdsScriptPromise) return googleAdsScriptPromise;

  googleAdsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Ads tag failed to load")), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(PRIMEVIEW_GOOGLE_ADS_TAG_ID)}`;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Ads tag failed to load")), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    googleAdsScriptPromise = null;
    throw error;
  });

  return googleAdsScriptPromise;
}

async function initializeGoogleAds() {
  await loadGoogleAdsScript();
  if (googleAdsInitialized) return;

  const gtag = getGoogleTag();
  gtag("js", new Date());
  gtag("config", PRIMEVIEW_GOOGLE_ADS_TAG_ID, {
    send_page_view: false,
    allow_ad_personalization_signals: false,
  });
  googleAdsInitialized = true;
}

function sendPageView(pageLocation: string) {
  if (lastPageLocation === pageLocation) return;
  getGoogleTag()("event", "page_view", {
    send_to: PRIMEVIEW_GOOGLE_ADS_TAG_ID,
    page_location: pageLocation,
  });
  lastPageLocation = pageLocation;
}

export function PrimeViewGoogleAds() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const booked = searchParams.get("booked");
  const [consent, setConsent] = useState<AnalyticsConsentState>(() =>
    typeof window === "undefined" ? "unknown" : readAnalyticsConsent(window.localStorage),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pageLocation = useMemo(
    () => typeof window === "undefined"
      ? null
      : buildPrimeViewGoogleAdsPageLocation(window.location.origin, pathname, booked),
    [booked, pathname],
  );

  useEffect(() => {
    setDefaultDeniedConsent();

    const syncConsent = () => setConsent(readAnalyticsConsent(window.localStorage));
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      syncConsent();
    };

    syncConsent();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (consent !== "granted") {
      updateGoogleAdsConsent("denied");
      lastPageLocation = null;
      return;
    }

    let cancelled = false;
    updateGoogleAdsConsent("granted");
    void initializeGoogleAds()
      .then(() => {
        if (cancelled || readAnalyticsConsent(window.localStorage) !== "granted" || !pageLocation) return;
        sendPageView(pageLocation);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [consent, pageLocation]);

  function chooseConsent(nextConsent: PersistedAnalyticsConsentState) {
    const stored = persistAnalyticsConsent(window.localStorage, nextConsent, () => {
      window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
    });
    if (!stored) return;
    setConsent(nextConsent);
    setSettingsOpen(false);
  }

  const showChoice = consent === "unknown" || settingsOpen;

  if (!showChoice) {
    return (
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="fixed bottom-3 left-3 z-[70] rounded-full border border-[#cbd5ce] bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#334139] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17452f] focus-visible:ring-offset-2"
        aria-label="Change measurement settings"
      >
        Measurement settings
      </button>
    );
  }

  return (
    <section
      className="fixed inset-x-2 bottom-2 z-[80] mx-auto max-h-[calc(100dvh-1rem)] max-w-md overflow-y-auto rounded-xl border border-[#d6ddd7] bg-white p-3 shadow-xl sm:inset-x-4 sm:bottom-4 sm:p-4"
      aria-labelledby="primeview-measurement-consent-title"
      aria-live="polite"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#526159]">Optional measurement</p>
      <h2 id="primeview-measurement-consent-title" className="mt-0.5 text-base font-black leading-5 text-[#17201a]">
        Allow website and booking measurement?
      </h2>
      <p className="mt-1.5 text-[13px] leading-5 text-[#526159]">
        PrimeView can use Google Ads measurement to understand whether an ad led to a completed booking. The Google tag only loads after you allow measurement. We do not send form text, names, email addresses or phone numbers, and ad personalisation stays disabled.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-[#cbd5ce] bg-white px-3 py-2 text-[13px] font-bold text-[#17201a]"
          onClick={() => chooseConsent("denied")}
        >
          Reject
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-[#17452f] bg-[#17452f] px-3 py-2 text-[13px] font-bold text-white"
          onClick={() => chooseConsent("granted")}
        >
          Allow measurement
        </button>
      </div>
      {consent !== "unknown" && (
        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className="mt-2 text-[11px] font-bold leading-4 text-[#526159] underline decoration-[#aab5ad] underline-offset-4"
        >
          Keep current choice and close
        </button>
      )}
    </section>
  );
}
