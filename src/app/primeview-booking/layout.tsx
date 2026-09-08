import type { Metadata } from "next";
import type { ReactNode } from "react";

import { primeViewSite } from "@/lib/primeview-seo";

const bookingUrl = `${primeViewSite.origin}/booking`;
const bookingTitle = "Book Online | PrimeView Window Care";
const bookingDescription =
  "Book window, gutter, pressure washing and exterior cleaning with PrimeView Window Care in West & North London.";
const bookingImageUrl = `${primeViewSite.origin}/primeview/services/window-cleaning.webp`;

export const metadata: Metadata = {
  metadataBase: new URL(primeViewSite.origin),
  applicationName: primeViewSite.name,
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: bookingUrl,
    siteName: primeViewSite.name,
    title: bookingTitle,
    description: bookingDescription,
    images: [
      {
        url: bookingImageUrl,
        alt: "PrimeView Window Care professional window cleaning in London",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: bookingTitle,
    description: bookingDescription,
    images: [bookingImageUrl],
  },
};

export default function PrimeViewBookingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="border-t border-[#d9e4ef] bg-[#eef3f9] px-5 py-4 text-center text-xs text-[#667b91]">
        Your personal information is handled in accordance with the{" "}
        <a href="/privacy" className="font-bold text-[#0a3c8f] underline underline-offset-3">
          PrimeView Privacy Policy
        </a>.
      </div>
    </>
  );
}
