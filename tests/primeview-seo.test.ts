import { describe, expect, it } from "vitest";

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
});
