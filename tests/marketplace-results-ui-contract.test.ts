import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import type { PublishedDirectorySearchResponse, PublishedDirectorySearchResult } from "@/lib/company-directory-public-search";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const baseResult: PublishedDirectorySearchResult = {
  id: "company-1",
  slug: "test-ror-ab",
  companyName: "Test Rör AB",
  categorySlug: "vvs",
  matchedServiceSlug: "vvs",
  matchedServiceLabel: "VVS / Rörmokare",
  activityDescription: "OFFICIAL SOURCE TEXT MUST NOT APPEAR IN THE RESULT CARD",
  addressLine1: "Testgatan 1",
  postalCode: "111 11",
  city: "Stockholm",
  municipality: "Stockholm",
  qualityScore: 95,
  distanceKm: null,
  serviceAreaRadiusKm: null,
  servesNearbyLocation: false,
  claimedWorkspaceSlug: null,
  claimedServiceId: null,
  claimedServiceSlug: null,
  claimedBookingSlug: null,
  conversionMode: null,
  bookingAvailable: false,
};

function response(results: PublishedDirectorySearchResult[]): PublishedDirectorySearchResponse {
  return {
    serviceQuery: "vvs",
    locationQuery: "Stockholm",
    serviceResolved: true,
    nearbyRequested: false,
    nearbyEnabled: false,
    radiusKm: 25,
    results,
  };
}

function render(locale: "sv" | "en", results: PublishedDirectorySearchResult[]) {
  return renderToStaticMarkup(createElement(PublicDirectoryResults, { locale, search: response(results) }));
}

describe("marketplace results UI contract", () => {
  it("renders localized customer metadata without official company prose", () => {
    const sv = render("sv", [baseResult]);
    const en = render("en", [baseResult]);

    expect(sv).toContain("Test Rör AB");
    expect(sv).toContain("VVS / Rörmokare");
    expect(sv).toContain("Företagsuppgifter verifierade");
    expect(sv).toContain("Registrerad i Stockholm");
    expect(sv).not.toContain(baseResult.activityDescription);

    expect(en).toContain("Test Rör AB");
    expect(en).toContain("Plumber / Plumbing");
    expect(en).toContain("Company details verified");
    expect(en).toContain("Registered in Stockholm");
    expect(en).not.toContain(baseResult.activityDescription);
  });

  it("renders real booking and quote actions for an enabled Marketplace result", () => {
    const marketplaceResult: PublishedDirectorySearchResult = {
      ...baseResult,
      id: "company-marketplace",
      slug: "marketplace-ror-ab",
      claimedWorkspaceSlug: "marketplace-ror",
      claimedServiceId: "svc-1",
      claimedServiceSlug: "vvs",
      claimedBookingSlug: "marketplace-ror",
      conversionMode: "book_or_quote",
      bookingAvailable: true,
    };
    const html = render("sv", [marketplaceResult]);

    expect(html).toContain("Boka tid");
    expect(html).toContain("Begär offert");
    expect(html).toContain('/boka/marketplace-ror?service_id=svc-1');
    expect(html).toContain('/foretag/marketplace-ror/tjanster/vvs#offert');
    expect(html).toContain('/foretag/marketplace-ror');
  });

  it("renders a read-only Directory fallback when Marketplace actions are unavailable", () => {
    const html = render("sv", [baseResult]);

    expect(html).toContain("Se företag");
    expect(html).toContain('/foretag/listad/test-ror-ab');
    expect(html).not.toContain("Boka tid");
    expect(html).not.toContain("Begär offert");
  });

  it("shows the generic quote promotion only when there are search results", () => {
    expect(render("sv", [baseResult])).toContain("Vill du jämföra flera företag?");
    expect(render("sv", [])).not.toContain("Vill du jämföra flera företag?");
  });

  it("uses a light compact search surface on the results page", () => {
    const searchPage = source("src/components/company-directory/public-directory-search-page.tsx");
    const searchForm = source("src/components/company-directory/public-directory-search-form.tsx");

    expect(searchPage).toContain('tone="light"');
    expect(searchPage).toContain("border border-line bg-surface");
    expect(searchPage).not.toContain("rounded-panel bg-brand-deep");
    expect(searchForm).toContain('tone?: "light" | "dark"');
  });
});
