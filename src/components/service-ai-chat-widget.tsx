"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const chatBaseUrl = "https://chat.proffera.se";
const widgetVersion = "59b1";

export function ServiceAiChatWidget() {
  const pathname = usePathname();
  const isAppRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/dashboard");

  if (isAppRoute) return null;

  return (
    <>
      <link
        rel="stylesheet"
        href={`${chatBaseUrl}/widget-mobile-polish.css?v=${widgetVersion}`}
      />
      <Script
        id="service-ai-chat-widget"
        src={`${chatBaseUrl}/widget-v2.js?v=${widgetVersion}`}
        strategy="afterInteractive"
        data-client-id="proffera"
        data-api-base={chatBaseUrl}
      />
      <Script
        id="service-ai-chat-guard"
        src={`${chatBaseUrl}/widget-v2-guard.js?v=${widgetVersion}`}
        strategy="afterInteractive"
      />
    </>
  );
}
