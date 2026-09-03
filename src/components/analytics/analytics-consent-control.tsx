"use client";

import { useEffect, useState } from "react";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  persistAnalyticsConsent,
  readAnalyticsConsent,
  type AnalyticsConsentState,
  type PersistedAnalyticsConsentState,
} from "@/lib/analytics/posthog-privacy";

type AnalyticsConsentLocale = "sv" | "en";

const consentCopy = {
  sv: {
    settingsLabel: "Ändra inställningar för analys",
    settingsButton: "Analysinställningar",
    eyebrow: "Valfri analys",
    title: "Vill du tillåta begränsad analys?",
    body: "Proffera kan använda sidvisningar och anonyma sessionssignaler för att förstå hur tjänsten används. Vi använder inte reklamspårning, formulärtext eller personuppgifter för denna analys. Inget skickas innan du väljer att tillåta analys.",
    reject: "Avvisa analys",
    accept: "Tillåt analys",
    close: "Behåll nuvarande val och stäng",
  },
  en: {
    settingsLabel: "Change analytics settings",
    settingsButton: "Analytics settings",
    eyebrow: "Optional analytics",
    title: "Allow limited analytics?",
    body: "Proffera can use page views and anonymous session signals to understand how the service is used. We do not use advertising tracking, form text or personal data for this analytics. Nothing is sent before you choose to allow analytics.",
    reject: "Reject analytics",
    accept: "Allow analytics",
    close: "Keep current choice and close",
  },
} as const;

const choiceButtonClass =
  "min-h-11 flex-1 rounded-xl border border-[#cbd5ce] bg-white px-4 py-2.5 text-sm font-bold text-[#17201a] transition hover:bg-[#f5f7f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17452f] focus-visible:ring-offset-2";

function currentDocumentLocale(): AnalyticsConsentLocale {
  if (typeof document === "undefined") return "sv";

  if (typeof window !== "undefined") {
    const queryLanguage = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
    if (queryLanguage === "en") return "en";
    if (queryLanguage === "sv") return "sv";
  }

  const routeLanguage = document.querySelector<HTMLElement>("main[lang]")?.getAttribute("lang")?.toLowerCase();
  if (routeLanguage?.startsWith("en")) return "en";
  if (routeLanguage?.startsWith("sv")) return "sv";

  if (document.documentElement.lang.toLowerCase().startsWith("en")) return "en";
  return "sv";
}

export function AnalyticsConsentControl() {
  const [locale, setLocale] = useState<AnalyticsConsentLocale>(() => currentDocumentLocale());
  const [consent, setConsent] = useState<AnalyticsConsentState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const labels = consentCopy[locale];

  useEffect(() => {
    const syncConsent = () => setConsent(readAnalyticsConsent(window.localStorage));
    const syncConsentFromStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      syncConsent();
    };
    const localeObserver = new MutationObserver(() => {
      setLocale(currentDocumentLocale());
    });

    syncConsent();
    localeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
      childList: true,
      subtree: true,
    });
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
    window.addEventListener("storage", syncConsentFromStorage);
    return () => {
      localeObserver.disconnect();
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
      window.removeEventListener("storage", syncConsentFromStorage);
    };
  }, []);

  function chooseConsent(nextConsent: PersistedAnalyticsConsentState) {
    const stored = persistAnalyticsConsent(window.localStorage, nextConsent, () => {
      window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
    });
    if (!stored) return;

    setConsent(nextConsent);
    setSettingsOpen(false);
  }

  if (consent === null) return null;

  const showChoice = consent === "unknown" || settingsOpen;

  if (!showChoice) {
    return (
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="fixed bottom-4 left-4 z-[70] rounded-full border border-[#cbd5ce] bg-white/95 px-4 py-2 text-xs font-bold text-[#334139] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17452f] focus-visible:ring-offset-2"
        aria-label={labels.settingsLabel}
      >
        {labels.settingsButton}
      </button>
    );
  }

  return (
    <section
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-2xl rounded-2xl border border-[#d6ddd7] bg-white p-5 shadow-2xl sm:inset-x-6 sm:bottom-6"
      aria-labelledby="analytics-consent-title"
      aria-live="polite"
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#526159]">{labels.eyebrow}</p>
      <h2 id="analytics-consent-title" className="mt-1 text-lg font-black text-[#17201a]">
        {labels.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#526159]">{labels.body}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className={choiceButtonClass} onClick={() => chooseConsent("denied")}>
          {labels.reject}
        </button>
        <button type="button" className={choiceButtonClass} onClick={() => chooseConsent("granted")}>
          {labels.accept}
        </button>
      </div>
      {consent !== "unknown" && (
        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className="mt-3 text-xs font-bold text-[#526159] underline decoration-[#aab5ad] underline-offset-4"
        >
          {labels.close}
        </button>
      )}
    </section>
  );
}
