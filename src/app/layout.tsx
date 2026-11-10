import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { AnalyticsConsentControl } from "@/components/analytics/analytics-consent-control";
import { PostHogAnalytics } from "@/components/analytics/posthog-analytics";
import { PrimeViewGoogleAdsAnalytics } from "@/components/analytics/primeview-google-ads-analytics";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceAiChatWidget } from "@/components/service-ai-chat-widget";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { WebVitalsReporter } from "@/components/performance/web-vitals-reporter";
import { resolvePostHogConfig } from "@/lib/analytics/posthog-privacy";
import { siteConfig } from "@/lib/site";
import { MARIA_PAYMENT_SHELL_HEADER } from "@/lib/maria-payment-standalone";
import { isMariaHost, isAnalyticsPlatformHost, isPlatformHost, isPrimeViewHost } from "@/lib/public-site-domains";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: "Proffera",
  manifest: "/manifest.webmanifest",
  title: {
    default: `${siteConfig.name} – SaaS för bokningar, leads och kundhantering`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "bokningssystem",
    "AI chatt företag",
    "leadhantering",
    "CRM småföretag",
    "SaaS Sverige",
    "digital bokning",
    "kundhantering",
  ],
  icons: {
    icon: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Proffera",
  },
  openGraph: {
    title: `${siteConfig.name} – SaaS för svenska tjänsteföretag`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "Proffera – Bokning, CRM och AI-assistent för tjänsteföretag",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} – SaaS för svenska tjänsteföretag`,
    description: siteConfig.description,
    images: ["/og"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a2e63",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const isCustomerSite = isPrimeViewHost(host);
  const isPlatformSite = isPlatformHost(host);
  // The proxy strips untrusted client markers and sets this only on an
  // exact Maria Swish booking page. Never apply the standalone shell to the
  // Proffera dashboard, platform host or any unrelated customer domain.
  const mariaPaymentStandalone = requestHeaders.get(MARIA_PAYMENT_SHELL_HEADER) === "1"
    && ((process.env.VERCEL_ENV === "preview" && isPlatformSite)
      || (process.env.VERCEL_ENV === "production"
        && isMariaHost(host)
        && process.env.PROFFERA_MARIA_PUBLIC_SITE_ENABLED === "true"));
  const postHogConfig = mariaPaymentStandalone ? null : resolvePostHogConfig();
  const shouldRenderAnalytics =
    postHogConfig !== null && isAnalyticsPlatformHost(host, postHogConfig.environment);
  const isEnglishPublicSite = requestHeaders.get("x-proffera-locale") === "en";
  const documentLanguage = isCustomerSite ? "en-GB" : isEnglishPublicSite ? "en" : "sv";

  return (
    <html lang={documentLanguage} className={isCustomerSite ? "primeview-site" : undefined}>
      <body className={`${hankenGrotesk.variable}${isCustomerSite ? " primeview-site" : ""}`}>
        {mariaPaymentStandalone
          ? children
          : isCustomerSite ? <main>{children}</main> : <AppShell>{children}</AppShell>}
        {!mariaPaymentStandalone && !isCustomerSite && <PwaServiceWorker />}
        {!mariaPaymentStandalone && !isCustomerSite && <ServiceAiChatWidget />}
        {!mariaPaymentStandalone && isPlatformSite && <AnalyticsConsentControl />}
        {!mariaPaymentStandalone && isCustomerSite && <AnalyticsConsentControl brand="primeview" />}
        {!mariaPaymentStandalone && isCustomerSite && <PrimeViewGoogleAdsAnalytics />}
        {shouldRenderAnalytics && <PostHogAnalytics config={postHogConfig} />}
        {!mariaPaymentStandalone && isPlatformSite && <WebVitalsReporter />}
      </body>
    </html>
  );
}
