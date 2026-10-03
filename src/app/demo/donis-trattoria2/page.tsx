import type { Metadata } from "next";

import { DonisTrattoriaLuxuryExperience } from "./demo-interactions";
import {
  getPublishedRestaurantSite,
  getRestaurantImageUrls,
} from "@/lib/restaurant-site-db";
import { projectPublicRestaurantSite } from "@/lib/restaurant-site-public";

const heroImage =
  "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-pizzorny.jpg";

export const metadata: Metadata = {
  applicationName: "Doni’s Trattoria",
  keywords: null,
  manifest: null,
  appleWebApp: null,
  title: { absolute: "Doni’s Trattoria | Dark concept" },
  description:
    "Alternativ mörk restaurangdemo för Doni’s Trattoria på Hornsbergs Strand i Stockholm.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Doni’s Trattoria | Dark concept",
    description:
      "Alternativ mörk restaurangdemo för Doni’s Trattoria i Stockholm.",
    type: "website",
    siteName: "Doni’s Trattoria",
    url: "https://www.proffera.se/demo/donis-trattoria2",
    images: [
      {
        url: heroImage,
        width: 1200,
        height: 900,
        alt: "Doni’s Trattoria",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Doni’s Trattoria | Dark concept",
    description:
      "Alternativ mörk restaurangdemo för Doni’s Trattoria i Stockholm.",
    images: [heroImage],
  },
};

export const dynamic = "force-dynamic";

export default async function DonisTrattoriaDemo2Page() {
  const publishedSite = await getPublishedRestaurantSite();
  const site = publishedSite ? projectPublicRestaurantSite(publishedSite) : null;
  const images = site ? await getRestaurantImageUrls(site) : {};

  return <DonisTrattoriaLuxuryExperience site={site} images={images} />;
}
