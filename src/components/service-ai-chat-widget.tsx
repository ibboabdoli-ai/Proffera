"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const chatBaseUrl = "https://chat.proffera.se";
const widgetVersion = "59b1";
const stableRoutePatch = `
(function () {
  if (window.__profferaChatStableRoutePatch) return;
  window.__profferaChatStableRoutePatch = true;
  var originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : input && input.url;
      if (
        typeof url === "string" &&
        url.indexOf("https://chat.proffera.se/api/chat") === 0 &&
        /\/api\/chat(?:\?|$)/.test(url)
      ) {
        var nextUrl = url.replace("/api/chat", "/api/chat-stable");
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
        id="service-ai-chat-stable-route-patch"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: stableRoutePatch }}
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
