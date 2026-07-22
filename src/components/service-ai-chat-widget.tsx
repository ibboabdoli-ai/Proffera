"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const widgetHost = "https://chat.proffera.se";
const clientId = "proffera";

type BookingAiChatWidgetProps = {
  clientId: string;
};

export function ServiceAiChatWidget() {
  const pathname = usePathname();
  const isSensitiveFlow = pathname?.startsWith("/admin")
    || pathname?.startsWith("/dashboard")
    || pathname?.startsWith("/demo/")
    || pathname?.startsWith("/boka/")
    || pathname?.startsWith("/logga-in")
    || pathname?.startsWith("/aktivera/")
    || pathname?.startsWith("/bjud-in/")
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

/**
 * Public booking pages belong to an individual workspace. They must never
 * load Proffera's own marketing bot: the client id comes from that
 * workspace's active AI Chat integration instead.
 */
export function BookingAiChatWidget({ clientId }: BookingAiChatWidgetProps) {
  if (!clientId) return null;

  return (
    <Script
      id={`proffera-booking-chat-widget-${clientId}`}
      src={`${widgetHost}/widget.js?v=20260616-9`}
      strategy="afterInteractive"
      data-client-id={clientId}
      data-api-base={widgetHost}
    />
  );
}
