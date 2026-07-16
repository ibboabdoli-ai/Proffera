"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const widgetHost = "https://chat.proffera.se";
const clientId = "proffera";

export function ServiceAiChatWidget() {
  const pathname = usePathname();
  const isSensitiveFlow = pathname?.startsWith("/admin")
    || pathname?.startsWith("/dashboard")
    || pathname?.startsWith("/boka/")
    || pathname?.startsWith("/logga-in")
    || pathname?.startsWith("/aktivera/")
    || pathname?.startsWith("/anslut-foretag/");

  if (isSensitiveFlow) return null;

  return (
    <Script
      id="proffera-chat-widget"
      src={`${widgetHost}/widget.js?v=20260616-9`}
      strategy="afterInteractive"
      data-client-id={clientId}
      data-api-base={widgetHost}
    />
  );
}
