import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { metadata as galleryMetadata } from "../src/app/gallery/page";
import { primeViewServices, primeViewSite, primeViewStructuredData } from "../src/lib/primeview-seo";

describe("PrimeView SEO source of truth", () => {
  it("uses the public PrimeView domain as the canonical URL", () => {
    expect(primeViewSite.canonicalUrl).toBe("https://www.primeviewwindowcare.co.uk/");
    expect(primeViewSite.openGraphImageUrl).toContain("www.primeviewwindowcare.co.uk");
  });

  it("publishes each PrimeView service in the structured service catalogue", () => {
    const graph = primeViewStructuredData["@graph"];
    const business = graph.find((node) => node["@type"] === "ProfessionalService");

    expect(business?.hasOfferCatalog.itemListElement).toHaveLength(primeViewServices.length);
    expect(business?.areaServed).toEqual([
      { "@type": "AdministrativeArea", name: "West London" },
      { "@type": "AdministrativeArea", name: "North London" },
    ]);
  });

  it("publishes complete metadata from the public Gallery route", () => {
    const galleryCanonical = `${primeViewSite.origin}/gallery`;
    const galleryTitle = "Gallery | PrimeView Window Care";

    expect(galleryMetadata.metadataBase).toEqual(new URL(primeViewSite.origin));
    expect(galleryMetadata.title).toEqual({ absolute: galleryTitle });
    expect(galleryMetadata.alternates).toEqual({ canonical: galleryCanonical });
    expect(galleryMetadata.robots).toEqual({ index: true, follow: true });
    expect(galleryMetadata.openGraph).toMatchObject({
      title: galleryTitle,
      url: galleryCanonical,
      siteName: primeViewSite.name,
      locale: "en_GB",
      type: "website",
    });
    expect(galleryMetadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: galleryTitle,
    });
  });

  it("keeps customer-facing gallery, booking and privacy metadata on the PrimeView brand", () => {
    const gallery = readFileSync("src/app/gallery/page.tsx", "utf8");
    const booking = readFileSync("src/app/primeview-booking/page.tsx", "utf8");
    const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");

    expect(gallery).toContain("alternates: { canonical: galleryCanonical }");
    expect(gallery).toContain("robots: { index: true, follow: true }");
    expect(gallery).toContain("title: { absolute: galleryTitle }");
    expect(gallery).toContain("url: galleryCanonical");
    expect(booking).toContain('title: { absolute: "Book Online | PrimeView Window Care" }');
    expect(privacy).toContain('title: { absolute: "Privacy Policy | PrimeView Window Care" }');
  });
});
