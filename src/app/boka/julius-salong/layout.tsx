import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./julius.css";

export const metadata: Metadata = {
  title: "Julius Salong – Boka tid",
  description: "Boka klippning och barberartjänster hos Julius Salong i Södertälje.",
  applicationName: "Julius Salong",
  manifest: "/boka/julius-salong/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Julius Salong",
  },
  icons: {
    icon: "/brand/julius-salong-app-icon.svg",
    apple: "/brand/julius-salong-app-icon.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Julius Salong",
  },
};

export default function JuliusBookingLayout({ children }: { children: ReactNode }) {
  const bookingTheme = {
    "--booking-primary": "#173e2b",
    "--booking-accent": "#d7a940",
  } as CSSProperties;

  return (
    <div data-booking-theme="salon" data-booking-appearance="light" style={bookingTheme}>
      {children}
    </div>
  );
}
