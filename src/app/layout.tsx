import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceAiChatWidget } from "@/components/service-ai-chat-widget";
import { siteConfig } from "@/lib/site";

const stableRoutePatch = `
(function () {
  if (window.__profferaChatStableRoutePatch) return;
  window.__profferaChatStableRoutePatch = true;
  var originalFetch = window.fetch.bind(window);

  function shouldRewrite(url) {
    if (typeof url !== "string") return false;
    if (url.indexOf("https://chat.proffera.se/api/chat") === 0) {
      return /\/api\/chat(?:\?|$)/.test(url);
    }
    return /^\/api\/chat(?:\?|$)/.test(url);
  }

  function rewriteUrl(url) {
    return url.replace("/api/chat", "/api/chat-stable");
  }

  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : input && input.url;
      if (shouldRewrite(url)) {
        var nextUrl = rewriteUrl(url);
        if (typeof input === "string") {
          return originalFetch(nextUrl, init);
        }
        return originalFetch(new Request(nextUrl, input), init);
      }
    } catch (error) {}
    return originalFetch(input, init);
  };
})();
`;

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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${siteConfig.name} – SaaS för svenska tjänsteföretag`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "sv_SE",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>
        <Script
          id="service-ai-chat-stable-route-patch"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: stableRoutePatch }}
        />
        <AppShell>{children}</AppShell>
        <ServiceAiChatWidget />
      </body>
    </html>
  );
}
