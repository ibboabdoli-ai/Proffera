import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ requestHeaders: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => mock.requestHeaders() }));
vi.mock("next/font/google", () => ({
  Hanken_Grotesk: () => ({ variable: "test-font" }),
}));
vi.mock("@/components/analytics/posthog-analytics", () => ({
  PostHogAnalytics: () => "POSTHOG_RENDERED",
}));
vi.mock("@/components/analytics/analytics-consent-control", () => ({
  AnalyticsConsentControl: () => "CONSENT_RENDERED",
}));
vi.mock("@/components/performance/web-vitals-reporter", () => ({
  WebVitalsReporter: () => "WEB_VITALS_RENDERED",
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement("div", { "data-testid": "proffera-shell" }, children),
}));
vi.mock("@/components/analytics/primeview-google-ads-analytics", () => ({
  PrimeViewGoogleAdsAnalytics: () => null,
}));
vi.mock("@/components/service-ai-chat-widget", () => ({
  ServiceAiChatWidget: () => "PROFFERA_CHAT_RENDERED",
}));
vi.mock("@/components/pwa-service-worker", () => ({
  PwaServiceWorker: () => "PROFFERA_PWA_RENDERED",
}));

import RootLayout from "@/app/layout";
import { MARIA_PAYMENT_SHELL_HEADER } from "@/lib/maria-payment-standalone";

const host = "proffera-git-feature-example.vercel.app";

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PREVIEW_KEY", "phc_synthetic");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PREVIEW_HOST", "https://eu.i.posthog.com");
  mock.requestHeaders.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

async function renderRoot(standalone: boolean, siteHost = host) {
  const headers = new Headers({ host: siteHost });
  if (standalone) headers.set(MARIA_PAYMENT_SHELL_HEADER, "1");
  mock.requestHeaders.mockReturnValue(headers);
  return renderToStaticMarkup(await RootLayout({
    children: createElement("main", { id: "synthetic-payment-page" }, "Test booking"),
  }));
}

describe("Maria Preview payment shell analytics privacy", () => {
  it("does not render analytics, consent UI or performance instrumentation on isolated Swish page", async () => {
    const html = await renderRoot(true);
    expect(html).toContain("synthetic-payment-page");
    expect(html).not.toContain("POSTHOG_RENDERED");
    expect(html).not.toContain("CONSENT_RENDERED");
    expect(html).not.toContain("WEB_VITALS_RENDERED");
  });

  it("renders only Maria branding in Production on its canonical payment origin", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    const html = await renderRoot(true, "makeupbymaria.se");
    expect(html).toContain("synthetic-payment-page");
    expect(html).not.toContain("proffera-shell");
    expect(html).not.toContain("PROFFERA_CHAT_RENDERED");
    expect(html).not.toContain("PROFFERA_PWA_RENDERED");
    expect(html).not.toContain("CONSENT_RENDERED");
    expect(html).not.toContain("WEB_VITALS_RENDERED");
  });

  it("never trusts a standalone marker on the Production Proffera host", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    const html = await renderRoot(true, "www.proffera.se");
    expect(html).toContain("proffera-shell");
    expect(html).toContain("PROFFERA_CHAT_RENDERED");
  });

  it("keeps the normal Preview analytics and consent gate on the platform", async () => {
    const html = await renderRoot(false);
    expect(html).toContain("POSTHOG_RENDERED");
    expect(html).toContain("CONSENT_RENDERED");
    expect(html).toContain("WEB_VITALS_RENDERED");
  });
});
