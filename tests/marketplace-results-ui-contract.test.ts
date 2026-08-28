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
    expect(sv).toContain("Verksamhetsplats: Stockholm");
    expect(sv).not.toContain("Registrerad i Stockholm");
    expect(sv).not.toContain(baseResult.activityDescription);

    expect(en).toContain("Test Rör AB");
    expect(en).toContain("Plumber / Plumbing");
    expect(en).toContain("Company details verified");
    expect(en).toContain("Business location: Stockholm");
    expect(en).not.toContain("Registered in Stockholm");
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
    const en = render(
      "en",
      [baseResult],
      { totalCount: 65, page: 1, pageSize: 30, totalPages: 3 },
      "/en/companies?service=Electrician&location=S%C3%B6dert%C3%A4lje",
    );

    expect(html).toContain("65 företag matchar din sökning");
    expect(html).toContain("Visar 1–30 av 65 företag");
    expect(html).toContain('aria-label="Sida 2"');
    expect(html).toContain('aria-label="Sida 3"');
    expect(html).toContain("service=Elektriker");
    expect(html).toContain("location=S%C3%B6dert%C3%A4lje");
    expect(html).toContain("page=2");
    expect(html).toContain("page=3");

    expect(en).toContain("65 businesses match your search");
    expect(en).toContain("Showing 1–30 of 65 businesses");
    expect(en).toContain('aria-label="Page 2"');
    expect(en).toContain('aria-label="Page 3"');
    expect(en).toContain("service=Electrician");
    expect(en).toContain("location=S%C3%B6dert%C3%A4lje");
    expect(en).toContain("page=2");
    expect(en).toContain("page=3");
  });

  it("shows the correct range on page two", () => {
    const html = render(
      "sv",
      [baseResult],
      { totalCount: 65, page: 2, pageSize: 30, totalPages: 3 },
      "/foretag/listad?service=Elektriker&location=S%C3%B6dert%C3%A4lje",
    );
    const en = render(
      "en",
      [baseResult],
      { totalCount: 65, page: 2, pageSize: 30, totalPages: 3 },
      "/en/companies?service=Electrician&location=S%C3%B6dert%C3%A4lje",
    );

    expect(html).toContain("Visar 31–60 av 65 företag");
    expect(html).toContain("Föregående");
    expect(html).toContain("Nästa");
    expect(html).toContain('aria-current="page" aria-label="Sida 2"');

    expect(en).toContain("Showing 31–60 of 65 businesses");
    expect(en).toContain("Previous");
    expect(en).toContain("Next");
    expect(en).toContain('aria-current="page" aria-label="Page 2"');
    expect(en).toContain("service=Electrician");
    expect(en).toContain("location=S%C3%B6dert%C3%A4lje");
  });

  it("shows the generic quote promotion only when there are search results", () => {
    expect(render("sv", [baseResult])).toContain("Vill du jämföra flera företag?");
    expect(render("sv", [])).not.toContain("Vill du jämföra flera företag?");
  });

  it("gives empty and invalid searches useful recovery actions", () => {
    const empty = render(
      "sv",
      [],
      {},
      "/foretag/listad?service=vvs&location=Stockholm",
    );
    const invalid = render("en", [], { serviceResolved: false });

    expect(empty).toContain("Kom vidare med ditt ärende");
    expect(empty).toContain("Sök i hela Sverige");
    expect(empty).toContain("/foretag/listad?service=vvs");
    expect(empty).toContain("Få offerter");
    expect(invalid).toContain("Try a popular service");
    expect(invalid).toContain("View all services");
    expect(invalid).toContain("Get quotes");
    expect(invalid).toMatch(/href="\/en\/companies\?service=[^"]+"/);
    expect(invalid).toContain('href="/en/companies"');
    expect(invalid).toContain('href="/en/get-quote"');

    const invalidWithLocation = render(
      "en",
      [],
      { serviceResolved: false },
      "/en/companies?service=plummber&location=Stockholm",
    );
    expect(invalidWithLocation).toMatch(
      /href="\/en\/companies\?service=[^&"]+&amp;location=Stockholm"/,
    );
  });

  it("does not offer a nationwide link that would reset a location-only search", () => {
    const locationOnly = render(
      "sv",
      [],
      {},
      "/foretag/listad?location=Stockholm",
    );

    expect(locationOnly).not.toContain("Sök i hela Sverige");
    expect(locationOnly).toContain("Få offerter");

    const serviceAndLocation = render(
      "sv",
      [],
      {},
      "/foretag/listad?service=stadning&location=Stockholm",
    );

    expect(serviceAndLocation).toContain("Sök i hela Sverige");
    expect(serviceAndLocation).toContain('href="/foretag/listad?service=stadning"');
  });

  it("keeps manual location and Nearby result navigation as separate URL modes", () => {
    const manual = render(
      "sv",
      [],
      { serviceQuery: "elektriker", locationQuery: "Stockholm", nearbyRequested: false, nearbyEnabled: false },
      "/foretag/listad?service=elektriker&location=Stockholm&page=2",
    );
    const nearby = render(
      "sv",
      [],
      { serviceQuery: "elektriker", locationQuery: "", nearbyRequested: true, nearbyEnabled: true, radiusKm: 25 },
      "/foretag/listad?service=elektriker&nearby=1&radius=25&page=2",
    );

    expect(manual).toContain("Sök i hela Sverige");
    expect(manual).toContain('href="/foretag/listad?service=elektriker"');
    expect(manual).not.toContain("nearby=1");
    expect(manual).not.toContain("latitude=");
    expect(manual).not.toContain("longitude=");

    expect(nearby).toContain("Sök i hela Sverige");
    expect(nearby).toContain('href="/foretag/listad?service=elektriker"');
    expect(nearby).not.toContain("latitude=");
    expect(nearby).not.toContain("longitude=");
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
