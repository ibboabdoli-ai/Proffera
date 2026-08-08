import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceAiChatWidget } from "@/components/service-ai-chat-widget";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { siteConfig } from "@/lib/site";
import { isPrimeViewHost } from "@/lib/public-site-domains";

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
  themeColor: "#17452f",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const isCustomerSite = isPrimeViewHost(requestHeaders.get("host"));
  const isEnglishPublicSite = requestHeaders.get("x-proffera-locale") === "en";
  const documentLanguage = isCustomerSite ? "en-GB" : isEnglishPublicSite ? "en" : "sv";

  return (
    <html lang={documentLanguage} className={isCustomerSite ? "primeview-site" : undefined}>
      <body className={`${hankenGrotesk.variable}${isCustomerSite ? " primeview-site" : ""}`}>
        {isCustomerSite ? <main>{children}</main> : <AppShell>{children}</AppShell>}
        {!isCustomerSite && <PwaServiceWorker />}
        {!isCustomerSite && <ServiceAiChatWidget />}
      </body>
    </html>
  );
}
