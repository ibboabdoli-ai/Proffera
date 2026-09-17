import type { Metadata } from "next";

import PrimeViewGalleryPage from "@/app/demo/primeview/gallery/page";
import { primeViewSite } from "@/lib/primeview-seo";

export const dynamic = "force-dynamic";

const galleryCanonical = `${primeViewSite.origin}/gallery`;
const galleryTitle = "Gallery | PrimeView Window Care";
const galleryDescription = "See recent window, gutter, exterior and pressure-cleaning work completed by PrimeView Window Care.";

export const metadata: Metadata = {
  metadataBase: new URL(primeViewSite.origin),
  title: { absolute: galleryTitle },
  description: galleryDescription,
  alternates: { canonical: galleryCanonical },
  robots: { index: true, follow: true },
  openGraph: {
    title: galleryTitle,
    description: galleryDescription,
    url: galleryCanonical,
    siteName: primeViewSite.name,
    locale: "en_GB",
    type: "website",
    images: [primeViewSite.openGraphImageUrl],
  },
  twitter: {
    card: "summary_large_image",
    title: galleryTitle,
    description: galleryDescription,
    images: [primeViewSite.openGraphImageUrl],
  },
};

export default PrimeViewGalleryPage;
