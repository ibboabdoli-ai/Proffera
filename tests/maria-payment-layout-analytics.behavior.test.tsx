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
  AnalyticsConsentControl: ({ brand }: { brand?: string }) => `CONSENT_RENDERED:${brand ?? "proffera"}`,
}));
vi.mock("@/components/performance/web-vitals-reporter", () => ({
  WebVitalsReporter: () => "WEB_VITALS_RENDERED",
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement("div", { "data-testid": "proffera-shell" }, children),
}));
vi.mock("@/components/analytics/primeview-google-ads-analytics", () => ({
  PrimeViewGoogleAdsAnalytics: () => "PRIMEVIEW_ADS_RENDERED",
}));
vi.mock("@/components/service-ai-chat-widget", () => ({
  ServiceAiChatWidget: () => "PROFFERA_CHAT_RENDERED",
}));
vi.mock("@/components/pwa-service-worker", () => ({
  PwaServiceWorker: () => "PROFFERA_PWA_RENDERED",
}));

import RootLayout, { metadata as profferaMetadata } from "@/app/layout";
import { MARIA_PAYMENT_SHELL_HEADER } from "@/lib/maria-payment-standalone";

const host = "proffera-git-feature-example.vercel.app";

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PREVIEW_KEY", "phc_synthetic");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PREVIEW_HOST", "https://eu.i.posthog.com");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_synthetic");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
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
  it("preserves the normal Proffera manifest and Apple title on the platform", () => {
    expect(profferaMetadata.manifest).toBe("/manifest.webmanifest");
    expect(profferaMetadata.appleWebApp).toMatchObject({title:"Proffera",capable:true});
  });

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

  it.each(["makeupbymaria.se", "www.makeupbymaria.se", "MAKEUPBYMARIA.SE", "makeupbymaria.se:443", "makeupbymaria.se."])(
    "uses the isolated Maria payment shell for trusted host variant %s", async hostVariant => {
      vi.stubEnv("VERCEL_ENV","production");
      vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED","true");
      const html=await renderRoot(true,hostVariant);
      expect(html).not.toContain("proffera-shell");
      expect(html).not.toContain("PROFFERA_CHAT_RENDERED");
    },
  );
  it("keeps ordinary shell if Maria Public Site flag is not enabled",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED","false");
    const html=await renderRoot(true,"makeupbymaria.se");
    expect(html).toContain("proffera-shell");
  });

  it("never trusts a standalone marker on the Production Proffera host", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    const html = await renderRoot(true, "www.proffera.se");
    expect(html).toContain("proffera-shell");
    expect(html).toContain("PROFFERA_CHAT_RENDERED");
  });

  it.each([
    ["preview", host],
    ["production", "proffera.se"],
    ["production", "www.proffera.se"],
  ])("leaves optional analytics unmounted in %s on %s even with PostHog configured", async (environment, siteHost) => {
    vi.stubEnv("VERCEL_ENV", environment);
    const html = await renderRoot(false, siteHost);
    expect(html).toContain("proffera-shell");
    expect(html).not.toContain("POSTHOG_RENDERED");
    expect(html).not.toContain("CONSENT_RENDERED");
    expect(html).not.toContain("PRIMEVIEW_ADS_RENDERED");
    expect(html).toContain("WEB_VITALS_RENDERED");
  });

  it("keeps the dedicated consent gate paired with Google Ads on PrimeView", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const html = await renderRoot(false, "primeviewwindowcare.co.uk");
    expect(html).toContain("CONSENT_RENDERED:primeview");
    expect(html).toContain("PRIMEVIEW_ADS_RENDERED");
    expect(html).not.toContain("POSTHOG_RENDERED");
  });
});
