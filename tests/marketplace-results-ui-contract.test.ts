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

function response(
  results: PublishedDirectorySearchResult[],
  overrides: Partial<PublishedDirectorySearchResponse> = {},
): PublishedDirectorySearchResponse {
  const totalCount = overrides.totalCount ?? results.length;
  const pageSize = overrides.pageSize ?? 30;
  return {
    serviceQuery: "vvs",
    locationQuery: "Stockholm",
    serviceResolved: true,
    nearbyRequested: false,
    nearbyEnabled: false,
    radiusKm: 25,
    results,
    totalCount,
    page: overrides.page ?? 1,
    pageSize,
    totalPages: overrides.totalPages ?? (totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0),
    ...overrides,
  };
}

function render(
  locale: "sv" | "en",
  results: PublishedDirectorySearchResult[],
  overrides: Partial<PublishedDirectorySearchResponse> = {},
  paginationBaseHref?: string,
) {
  return renderToStaticMarkup(createElement(PublicDirectoryResults, {
    locale,
    search: response(results, overrides),
    paginationBaseHref,
  }));
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

    expect(html).toContain('data-marketplace-action="book"');
    expect(html).toContain('data-marketplace-action="quote"');
    expect(html).toContain("Boka tid");
    expect(html).toContain("Begär offert");
    expect(html).toContain('/boka/marketplace-ror?service_id=svc-1');
    expect(html).toContain('/foretag/marketplace-ror/tjanster/vvs#offert');
    expect(html).toContain('/foretag/marketplace-ror');
  });

  it("renders contact and service fallbacks according to conversion mode", () => {
    const contactResult: PublishedDirectorySearchResult = {
      ...baseResult,
      id: "contact-company",
      claimedWorkspaceSlug: "contact-company",
      claimedServiceId: "svc-contact",
      claimedServiceSlug: "vvs",
      conversionMode: "contact",
    };
    const unavailableBookingResult: PublishedDirectorySearchResult = {
      ...baseResult,
      id: "booking-unavailable",
      claimedWorkspaceSlug: "booking-unavailable",
      claimedServiceId: "svc-book",
      claimedServiceSlug: "vvs",
      claimedBookingSlug: "booking-unavailable",
      conversionMode: "book",
      bookingAvailable: false,
    };

    const contactHtml = render("sv", [contactResult]);
    expect(contactHtml).toContain('data-marketplace-action="contact"');
    expect(contactHtml).toContain("Kontakta");
    expect(contactHtml).toContain("#kontaktforfragan");
    expect(contactHtml).not.toContain('data-marketplace-action="book"');

    const serviceHtml = render("sv", [unavailableBookingResult]);
    expect(serviceHtml).toContain('data-marketplace-action="service"');
    expect(serviceHtml).toContain("Se tjänst");
    expect(serviceHtml).not.toContain('data-marketplace-action="book"');
  });

  it("renders a read-only Directory fallback when Marketplace actions are unavailable", () => {
    const html = render("sv", [baseResult]);

    expect(html).toContain('data-marketplace-action="directory-profile"');
    expect(html).toContain("Se företag");
    expect(html).toContain('/foretag/listad/test-ror-ab');
    expect(html).not.toContain("Boka tid");
    expect(html).not.toContain("Begär offert");
  });

  it("shows real totals and page 1, 2 and 3 links while preserving the search", () => {
    const html = render(
      "sv",
      [baseResult],
      { totalCount: 65, page: 1, pageSize: 30, totalPages: 3 },
      "/foretag/listad?service=Elektriker&location=S%C3%B6dert%C3%A4lje",
    );

    expect(html).toContain("65 företag matchar din sökning");
    expect(html).toContain("Visar 1–30 av 65 företag");
    expect(html).toContain('aria-label="Sida 2"');
    expect(html).toContain('aria-label="Sida 3"');
    expect(html).toContain("service=Elektriker");
    expect(html).toContain("location=S%C3%B6dert%C3%A4lje");
    expect(html).toContain("page=2");
    expect(html).toContain("page=3");
  });

  it("shows the correct range on page two", () => {
    const html = render(
      "sv",
      [baseResult],
      { totalCount: 65, page: 2, pageSize: 30, totalPages: 3 },
      "/foretag/listad?service=Elektriker&location=S%C3%B6dert%C3%A4lje",
    );

    expect(html).toContain("Visar 31–60 av 65 företag");
    expect(html).toContain("Föregående");
    expect(html).toContain("Nästa");
    expect(html).toContain('aria-current="page"');
  });

  it("shows the generic quote promotion only when there are search results", () => {
    expect(render("sv", [baseResult])).toContain("Vill du jämföra flera företag?");
    expect(render("sv", [])).not.toContain("Vill du jämföra flera företag?");
  });

  it("does not manufacture a Near me attempt for a manual location search", () => {
    const searchPage = source("src/components/company-directory/public-directory-search-page.tsx");

    expect(searchPage).toContain("const latitude = firstParam(params?.latitude);");
    expect(searchPage).toContain("const longitude = firstParam(params?.longitude);");
    expect(searchPage).not.toContain('const latitude = firstParam(params?.latitude) ?? ""');
    expect(searchPage).not.toContain('const longitude = firstParam(params?.longitude) ?? ""');
    expect(searchPage).toContain("search?.nearbyRequested && !search.nearbyEnabled");
  });

  it("uses the compact Home-style search surface and denser result cards", () => {
    const searchPage = source("src/components/company-directory/public-directory-search-page.tsx");
    const results = source("src/components/company-directory/public-directory-results.tsx");

    expect(searchPage).toContain('tone="light" layout="hero"');
    expect(searchPage).toContain("max-w-7xl");
    expect(searchPage).not.toContain("<header");
    expect(results).toContain("md:grid-cols-[minmax(0,1fr)_160px]");
    expect(results).toContain("rounded-2xl border border-line bg-surface p-4");
  });
});
