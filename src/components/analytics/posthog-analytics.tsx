"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentFromStoredValue,
  analyticsSourceFromReferrer,
  isAnalyticsConsentGranted,
  sanitizeAnalyticsPathname,
  sanitizePageUrl,
  sanitizePostHogEvent,
  shouldCapturePageview,
  type AnalyticsConsentState,
  type PostHogPublicConfig,
} from "@/lib/analytics/posthog-privacy";

type PostHogClient = typeof import("posthog-js")["default"];

let postHogClientPromise: Promise<PostHogClient | null> | null = null;
let initializedConfigKey: string | null = null;
let lastCapturedPageKey: string | null = null;

function readConsent(): AnalyticsConsentState {
  try {
    return analyticsConsentFromStoredValue(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
  } catch {
    return "unknown";
  }
}

async function loadPostHog(config: PostHogPublicConfig) {
  const configKey = `${config.environment}:${config.host}:${config.key}`;
  if (initializedConfigKey && initializedConfigKey !== configKey) return null;

  if (!postHogClientPromise) {
    postHogClientPromise = import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(config.key, {
          api_host: config.host,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_performance: false,
          disable_session_recording: true,
          person_profiles: "never",
          persistence: "localStorage",
          ip: false,
          advanced_disable_flags: true,
          advanced_disable_toolbar_metrics: true,
          before_send: sanitizePostHogEvent,
        });
        initializedConfigKey = configKey;
        return posthog;
      })
      .catch(() => null);
  }

  return postHogClientPromise;
}

export function PostHogAnalytics({ config }: { config: PostHogPublicConfig }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsentState>(() =>
    typeof window === "undefined" ? "unknown" : readConsent(),
  );

  useEffect(() => {
    const handleConsentChange = () => setConsent(readConsent());
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChange);
    return () => window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChange);
  }, []);

  useEffect(() => {
    if (consent === "denied") {
      void postHogClientPromise?.then((posthog) => posthog?.opt_out_capturing()).catch(() => undefined);
      return;
    }
    if (!isAnalyticsConsentGranted(consent)) return;

    let cancelled = false;
    const sanitizedPathname = sanitizeAnalyticsPathname(pathname || "/");
    const pageUrl = sanitizePageUrl(window.location.origin, sanitizedPathname);
    const pageKey = `${config.environment}:${pageUrl}`;

    if (!shouldCapturePageview(lastCapturedPageKey, pageKey)) return;

    void loadPostHog(config).then((posthog) => {
      if (!posthog || cancelled) return;
      posthog.opt_in_capturing();
      if (!shouldCapturePageview(lastCapturedPageKey, pageKey)) return;

      posthog.capture("$pageview", {
        $current_url: pageUrl,
        $pathname: sanitizedPathname,
        proffera_environment: config.environment,
        source: analyticsSourceFromReferrer(document.referrer),
        $process_person_profile: false,
      });
      lastCapturedPageKey = pageKey;
    });

    return () => {
      cancelled = true;
    };
  }, [config, consent, pathname]);

  return null;
}
