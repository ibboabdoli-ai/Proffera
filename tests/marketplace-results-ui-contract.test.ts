import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const directorySearchMocks = vi.hoisted(() => ({
  getPublishedDirectoryLocationSuggestions: vi.fn(),
  searchPublishedCompanyDirectory: vi.fn(),
}));

vi.mock("@/lib/company-directory-public-search", () => ({
  getPublishedDirectoryLocationSuggestions: directorySearchMocks.getPublishedDirectoryLocationSuggestions,
  searchPublishedCompanyDirectory: directorySearchMocks.searchPublishedCompanyDirectory,
}));

import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import { PublicDirectorySearchPage } from "@/components/company-directory/public-directory-search-page";
import type { PublishedDirectorySearchResponse, PublishedDirectorySearchResult } from "@/lib/company-directory-public-search";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function escapedHref(href: string) {
  return `href="${href.replaceAll("&", "&amp;")}"`;
}

function countOccurrences(value: string, token: string) {
  return value.split(token).length - 1;
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

  it("renders exact Swedish and English pagination destinations from the real search-page filter path", async () => {
    directorySearchMocks.getPublishedDirectoryLocationSuggestions.mockResolvedValue([]);
    directorySearchMocks.searchPublishedCompanyDirectory.mockResolvedValue(
      response([baseResult], { totalCount: 65, page: 2, pageSize: 30, totalPages: 3 }),
    );

    const svElement = await PublicDirectorySearchPage({
      locale: "sv",
      searchParams: Promise.resolve({
        service: "Elektriker",
        location: "Södertälje",
        latitude: "59.1955",
        longitude: "17.6253",
        radius: "30",
        page: "2",
      }),
    });
    const sv = renderToStaticMarkup(svElement);
    const svPage1 = "/foretag/listad?service=Elektriker&location=S%C3%B6dert%C3%A4lje&latitude=59.1955&longitude=17.6253&radius=30";
    const svPage3 = `${svPage1}&page=3`;

    expect(directorySearchMocks.searchPublishedCompanyDirectory).toHaveBeenCalledWith({
      service: "Elektriker",
      location: "Södertälje",
      latitude: "59.1955",
      longitude: "17.6253",
      radiusKm: "30",
      page: "2",
      limit: 30,
    });
    expect(sv).toContain("Visar 31–60 av 65 företag");
    expect(sv).toContain('aria-current="page" aria-label="Sida 2"');
    expect(sv).toContain("Föregående");
    expect(sv).toContain("Nästa");
    expect(countOccurrences(sv, escapedHref(svPage1))).toBeGreaterThanOrEqual(2);
    expect(countOccurrences(sv, escapedHref(svPage3))).toBeGreaterThanOrEqual(2);

    directorySearchMocks.searchPublishedCompanyDirectory.mockClear();
    const enElement = await PublicDirectorySearchPage({
      locale: "en",
      searchParams: Promise.resolve({
        service: "Electrician",
        location: "Södertälje",
        latitude: "59.1955",
        longitude: "17.6253",
        radius: "30",
        page: "2",
      }),
    });
    const en = renderToStaticMarkup(enElement);
    const enPage1 = "/en/companies?service=Electrician&location=S%C3%B6dert%C3%A4lje&latitude=59.1955&longitude=17.6253&radius=30";
    const enPage3 = `${enPage1}&page=3`;

    expect(directorySearchMocks.searchPublishedCompanyDirectory).toHaveBeenCalledWith({
      service: "elinstallation",
      location: "Södertälje",
      latitude: "59.1955",
      longitude: "17.6253",
      radiusKm: "30",
      page: "2",
      limit: 30,
    });
    expect(en).toContain("Showing 31–60 of 65 businesses");
    expect(en).toContain('aria-current="page" aria-label="Page 2"');
    expect(en).toContain("Previous");
    expect(en).toContain("Next");
    expect(countOccurrences(en, escapedHref(enPage1))).toBeGreaterThanOrEqual(2);
    expect(countOccurrences(en, escapedHref(enPage3))).toBeGreaterThanOrEqual(2);
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
