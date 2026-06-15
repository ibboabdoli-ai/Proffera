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
      src={`${widgetHost}/widget-v2.js`}
      strategy="afterInteractive"
      data-client-id={clientId}
    />
  );
}
