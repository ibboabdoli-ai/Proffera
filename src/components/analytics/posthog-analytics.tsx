"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  MARKETPLACE_FUNNEL_BROWSER_EVENT,
  buildMarketplaceFunnelPostHogEvent,
} from "@/lib/analytics/marketplace-funnel-events";
import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsSourceFromReferrer,
  isAnalyticsConsentGranted,
  readAnalyticsConsent,
  sanitizeAnalyticsPathname,
  sanitizePageUrl,
  shouldCapturePageview,
  type AnalyticsConsentState,
  type PostHogPublicConfig,
} from "@/lib/analytics/posthog-privacy";
import { sanitizePostHogEvent } from "@/lib/analytics/posthog-send-boundary";

type PostHogClient = typeof import("posthog-js")["default"];
type MarketplaceCaptureDependencies = {
  loadClient?: (config: PostHogPublicConfig) => Promise<PostHogClient | null>;
  readCurrentConsent?: () => AnalyticsConsentState;
  isCancelled?: () => boolean;
};

let postHogClientPromise: Promise<PostHogClient | null> | null = null;
let initializedConfigKey: string | null = null;
let lastCapturedPageKey: string | null = null;

function readConsent(): AnalyticsConsentState {
  return readAnalyticsConsent(window.localStorage);
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
      .catch(() => {
        postHogClientPromise = null;
        return null;
      });
  }

  return postHogClientPromise;
}

export async function captureMarketplaceEvent(
  config: PostHogPublicConfig,
  input: unknown,
  dependencies: MarketplaceCaptureDependencies = {},
) {
  const sanitized = buildMarketplaceFunnelPostHogEvent(input, config.environment);
  if (!sanitized) return false;

  const loadClient = dependencies.loadClient ?? loadPostHog;
  const readCurrentConsent = dependencies.readCurrentConsent ?? readConsent;
  const isCancelled = dependencies.isCancelled ?? (() => false);
  const posthog = await loadClient(config);
  if (!posthog || isCancelled() || !isAnalyticsConsentGranted(readCurrentConsent())) return false;

  posthog.opt_in_capturing();
  if (isCancelled() || !isAnalyticsConsentGranted(readCurrentConsent())) {
    posthog.opt_out_capturing();
    return false;
  }

  posthog.capture(sanitized.event, sanitized.properties);
  return true;
}

function optOutLoadedPostHog() {
  lastCapturedPageKey = null;
  void postHogClientPromise?.then((posthog) => posthog?.opt_out_capturing()).catch(() => undefined);
}

export function PostHogAnalytics({ config }: { config: PostHogPublicConfig }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsentState>(() =>
    typeof window === "undefined" ? "unknown" : readConsent(),
  );

  useEffect(() => {
    const handleConsentChange = () => setConsent(readConsent());
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== ANALYTICS_CONSENT_STORAGE_KEY) return;
      handleConsentChange();
    };

    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handleMarketplaceEvent = (event: Event) => {
      if (!isAnalyticsConsentGranted(consent)) return;
      void captureMarketplaceEvent(config, event instanceof CustomEvent ? event.detail : null, {
        isCancelled: () => cancelled,
      });
    };

    window.addEventListener(MARKETPLACE_FUNNEL_BROWSER_EVENT, handleMarketplaceEvent);
    return () => {
      cancelled = true;
      window.removeEventListener(MARKETPLACE_FUNNEL_BROWSER_EVENT, handleMarketplaceEvent);
    };
  }, [config, consent]);

  useEffect(() => {
    if (consent === "denied") {
      optOutLoadedPostHog();
      return;
    }
    if (consent === "unknown") {
      optOutLoadedPostHog();
      return;
    }
    if (!isAnalyticsConsentGranted(consent)) return;

    let cancelled = false;
    const sanitizedPathname = sanitizeAnalyticsPathname(pathname || "/");
    const pageUrl = sanitizePageUrl(window.location.origin, sanitizedPathname);
    const pageKey = `${config.environment}:${pageUrl}`;

    void loadPostHog(config).then((posthog) => {
      if (!posthog || cancelled || !isAnalyticsConsentGranted(readConsent())) return;
      posthog.opt_in_capturing();
      if (cancelled || !isAnalyticsConsentGranted(readConsent())) {
        posthog.opt_out_capturing();
        return;
      }
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
