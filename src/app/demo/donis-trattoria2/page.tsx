import type { Metadata } from "next";
import { cache } from "react";

import { DonisTrattoriaLuxuryExperience } from "./demo-interactions";
import {
  DONIS_LUXURY_FALLBACK_IMAGES,
  DONIS_LUXURY_FALLBACK_SITE,
} from "@/lib/donis-luxury-fallback";
import {
  getPublishedRestaurantSite,
  getRestaurantImageUrls,
} from "@/lib/restaurant-site-db";
import { projectPublicRestaurantSite } from "@/lib/restaurant-site-public";

const getDemo2Data = cache(async () => {
  const publishedSite = await getPublishedRestaurantSite();
  const site = publishedSite ? projectPublicRestaurantSite(publishedSite) : null;
  const displaySite = site ?? DONIS_LUXURY_FALLBACK_SITE;
  const images = site
    ? await getRestaurantImageUrls(site)
    : DONIS_LUXURY_FALLBACK_IMAGES;

  return { site, displaySite, images };
});

export async function generateMetadata(): Promise<Metadata> {
  const { displaySite, images } = await getDemo2Data();
  const business = displaySite.business;
  const name = business.name;
  const title = business.city ? `${name} | ${business.city}` : name;
  const description =
    displaySite.text.heroDescription.sv.trim() ||
    displaySite.text.story.sv.trim() ||
    (business.city ? `${name} i ${business.city}.` : name);
  const hero = displaySite.media.hero;
  const heroUrl = hero ? images[hero.id] : undefined;
  const socialImages = heroUrl
    ? [{ url: heroUrl, alt: hero?.alt.sv || name }]
    : undefined;

  return {
    applicationName: name,
    keywords: null,
    manifest: null,
    appleWebApp: null,
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: name,
      url: "https://www.proffera.se/demo/donis-trattoria2",
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: heroUrl ? [heroUrl] : undefined,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function DonisTrattoriaDemo2Page() {
  const { site, images } = await getDemo2Data();

  return <DonisTrattoriaLuxuryExperience site={site} images={images} />;
}
