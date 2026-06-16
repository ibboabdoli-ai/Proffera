"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const widgetHost = "https://chat.proffera.se";
const clientId = "proffera";

export function ServiceAiChatWidget() {
  const pathname = usePathname();
  const isPrivateRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/dashboard");

  if (isPrivateRoute) return null;

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
