import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceAiChatWidget } from "@/components/service-ai-chat-widget";
import { siteConfig } from "@/lib/site";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken-grotesk",
});
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} – SaaS för bokningar, leads och AI-kommunikation`,
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
  openGraph: {
    title: `${siteConfig.name} – SaaS för svenska tjänsteföretag`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/brand/proffera-og.svg",
        width: 1200,
        height: 630,
        alt: "Proffera",
      },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body className={hankenGrotesk.variable}>
        <AppShell>{children}</AppShell>
        <ServiceAiChatWidget />
      </body>
    </html>
  );
}
