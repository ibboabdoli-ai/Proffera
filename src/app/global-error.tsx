"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getPublicLocale, type PublicLocale } from "@/lib/public-locale";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import { classifyWebVitalRoute } from "@/lib/web-vitals-route";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

type GlobalErrorPresentation = {
  locale: PublicLocale;
  documentLanguage: "sv" | "en" | "en-GB";
};

const errorCopy = {
  sv: {
    title: "Något gick fel",
    description: "Försök igen. Om problemet fortsätter kan du kontakta Proffera support.",
    retry: "Försök igen",
  },
  en: {
    title: "Something went wrong",
    description: "Try again. If the problem continues, contact Proffera support.",
    retry: "Try again",
  },
} as const;

const stableFallback: GlobalErrorPresentation = {
  locale: "sv",
  documentLanguage: "sv",
};

function subscribeToBrowserLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function browserLocationSnapshot() {
  return `${window.location.hostname}\n${window.location.pathname}`;
}

function serverLocationSnapshot() {
  return "";
}

export function resolveGlobalErrorPresentation(
  pathname: string | null | undefined,
  hostname: string | null | undefined,
): GlobalErrorPresentation {
  if (isPrimeViewHost(hostname)) {
    return { locale: "en", documentLanguage: "en-GB" };
  }

  const locale = getPublicLocale(pathname);
  return { locale, documentLanguage: locale };
}

function reportGlobalError(error: GlobalErrorProps["error"]) {
  if (process.env.NODE_ENV !== "production") return;

  const payload = JSON.stringify({
    name: error.name || "Error",
    digest: error.digest ?? "",
    routeGroup: classifyWebVitalRoute(window.location.pathname),
  });

  const blob = new Blob([payload], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/observability/client-error", blob)) return;

  void fetch("/api/observability/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  // Proffera uses Proxy rewrites. useSyncExternalStore gives SSR/hydration a
  // stable fallback and applies the browser-visible host/path after hydration,
  // avoiding pathname hydration mismatches on rewritten customer routes.
  const browserLocation = useSyncExternalStore(
    subscribeToBrowserLocation,
    browserLocationSnapshot,
    serverLocationSnapshot,
  );
  const [hostname, pathname] = browserLocation
    ? browserLocation.split("\n", 2)
    : ["", ""];
  const presentation = browserLocation
    ? resolveGlobalErrorPresentation(pathname, hostname)
    : stableFallback;
  const copy = errorCopy[presentation.locale];

  useEffect(() => {
    reportGlobalError(error);
  }, [error]);

  return (
    <html lang={presentation.documentLanguage}>
      <body>
        <main style={{ maxWidth: 560, margin: "64px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          <button type="button" onClick={reset}>{copy.retry}</button>
        </main>
      </body>
    </html>
  );
}
