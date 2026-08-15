import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Proffera Kalender",
  description: "Bokningskalender för Proffera.",
  applicationName: "Proffera Kalender",
  manifest: "/dashboard/kalender/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kalender",
  },
  icons: {
    icon: "/brand/proffera-calendar-app-icon.svg",
    apple: "/brand/proffera-calendar-app-icon.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Kalender",
  },
};

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return children;
}
