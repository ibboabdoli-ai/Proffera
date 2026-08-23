import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import type { PublishedDirectorySearchResponse, PublishedDirectorySearchResult } from "@/lib/company-directory-public-search";

const profileRedirectMocks = vi.hoisted(() => ({
  getPublicBusinessProfileViewForRequest: vi.fn(),
  getClaimedDirectoryWorkspaceSlug: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/business-profile-public", () => ({
  getPublicBusinessProfileViewForRequest: profileRedirectMocks.getPublicBusinessProfileViewForRequest,
}));
vi.mock("@/lib/company-directory-routing", () => ({
  getClaimedDirectoryWorkspaceSlug: profileRedirectMocks.getClaimedDirectoryWorkspaceSlug,
}));
vi.mock("next/navigation", () => ({
  redirect: profileRedirectMocks.redirect,
  notFound: profileRedirectMocks.notFound,
}));

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const baseResult: PublishedDirectorySearchResult = {
  id: "directory-company",
  slug: "directory-company",
  companyName: "Directory Company AB",
  categorySlug: "frisor",
  matchedServiceSlug: "frisor",
  matchedServiceLabel: "Frisör / Barberare",
  activityDescription: "",
  addressLine1: "Testgatan 1",
  postalCode: "151 00",
  city: "Södertälje",
  municipality: "Södertälje",
  qualityScore: 95,
  distanceKm: null,
  serviceAreaRadiusKm: 20,
  servesNearbyLocation: false,
  claimedWorkspaceSlug: null,
  claimedServiceId: null,
  claimedServiceSlug: null,
  claimedBookingSlug: null,
  conversionMode: null,
  bookingAvailable: false,
};

function renderResult(overrides: Partial<PublishedDirectorySearchResult> = {}) {
  const result = { ...baseResult, ...overrides };
  const search: PublishedDirectorySearchResponse = {
    serviceQuery: "frisor",
    locationQuery: "Södertälje",
    serviceResolved: true,
    nearbyRequested: false,
    nearbyEnabled: false,
    radiusKm: 25,
    results: [result],
    totalCount: 1,
    page: 1,
    pageSize: 30,
    totalPages: 1,
  };
  return renderToStaticMarkup(createElement(PublicDirectoryResults, { locale: "sv", search }));
}

describe("hybrid directory marketplace search", () => {
  const searchSource = source("src/lib/company-directory-public-search.ts");
  const publicDataSource = source("src/lib/company-directory-public-data.ts");
  const routingSource = source("src/lib/company-directory-routing.ts");
  const entitlementSource = source("src/lib/workspace-feature-entitlement-db.ts");

  it("keeps unclaimed published profiles and safe previously-published claimed profiles searchable", () => {
    expect(searchSource).toContain("profile.publication_status = 'published'");
    expect(searchSource).toContain("profile.publication_status = 'claimed'");
    expect(searchSource).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(searchSource).toContain("profile.published_at is not null");
    expect(searchSource).toContain("profile.auto_public_eligible = true");
    expect(searchSource).toContain("claimed_workspace.status in ('active', 'trial')");
    expect(searchSource).toContain("profile.is_active = true");
    expect(searchSource).toContain("profile.privacy_blocked = false");
  });

  it("keeps a claimed Starter company on the safe Directory fallback instead of requiring Business Page access", () => {
    expect(publicDataSource).toContain("getSafeClaimedDirectoryFallback");
    expect(publicDataSource).toContain("profile.publication_status = 'claimed'");
    expect(publicDataSource).toContain("profile.published_at is not null");
    expect(publicDataSource).toContain("profile.auto_public_eligible = true");
    expect(publicDataSource).toContain("profile.privacy_blocked = false");
  });

  it("only upgrades a claimed result to Marketplace actions with an exact published workspace-service mapping", () => {
    expect(searchSource).toContain("claimed_service.is_active = true");
    expect(searchSource).toContain("claimed_service.public_status = 'published'");
    expect(searchSource).toContain("coalesce(claimed_service.primary_directory_service_slug, claimed_service.public_slug) = relation.service_slug");
    expect(searchSource).toContain("const marketplaceAvailable = Boolean(");
    expect(searchSource).toContain("&& row.claimed_service_id");
    expect(searchSource).toContain("&& row.claimed_service_slug");
    expect(searchSource).toContain("claimedWorkspaceSlug: marketplaceAvailable");
  });

  it("requires canonical Business Page access before Marketplace routing or redirect", () => {
    expect(searchSource).toContain("getWorkspaceDirectoryPublicAccessForWorkspaces(claimedWorkspaceIds)");
    expect(entitlementSource).toContain("catalog.feature_key in ('website_builder', 'online_booking')");
    expect(searchSource).toContain("&& access?.websiteBuilder");
    expect(routingSource).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder")');
    expect(routingSource).toContain("return websiteBuilder ? workspaceSlug : null");
  });

  it("only exposes direct booking when canonical booking access and booking slug are present", () => {
    expect(searchSource).toContain("getWorkspaceDirectoryPublicAccessForWorkspaces(claimedWorkspaceIds)");
    expect(entitlementSource).toContain("featureKey === \"online_booking\"");
    expect(searchSource).toContain("claimedBookingSlug");
    expect(searchSource).toContain('conversionMode === "book" || conversionMode === "book_or_quote"');
  });

  it("renders the correct action for book, quote, book_or_quote, contact and Directory fallback modes", () => {
    const commonMarketplace = {
      claimedWorkspaceSlug: "marketplace-company",
      claimedServiceId: "service-1",
      claimedServiceSlug: "frisor",
    } as const;

    const bookHtml = renderResult({
      ...commonMarketplace,
      claimedBookingSlug: "marketplace-company",
      conversionMode: "book",
      bookingAvailable: true,
    });
    expect(bookHtml).toContain('data-marketplace-action="book"');
    expect(bookHtml).toContain('/boka/marketplace-company?service_id=service-1');
    expect(bookHtml).not.toContain('data-marketplace-action="quote"');

    const quoteHtml = renderResult({
      ...commonMarketplace,
      conversionMode: "quote",
      bookingAvailable: false,
    });
    expect(quoteHtml).toContain('data-marketplace-action="quote"');
    expect(quoteHtml).toContain('/foretag/marketplace-company/tjanster/frisor#offert');
    expect(quoteHtml).not.toContain('data-marketplace-action="book"');

    const hybridHtml = renderResult({
      ...commonMarketplace,
      claimedBookingSlug: "marketplace-company",
      conversionMode: "book_or_quote",
      bookingAvailable: true,
    });
    expect(hybridHtml).toContain('data-marketplace-action="book"');
    expect(hybridHtml).toContain('/boka/marketplace-company?service_id=service-1');
    expect(hybridHtml).toContain('data-marketplace-action="quote"');
    expect(hybridHtml).toContain('/foretag/marketplace-company/tjanster/frisor#offert');

    const contactHtml = renderResult({
      ...commonMarketplace,
      conversionMode: "contact",
      bookingAvailable: false,
    });
    expect(contactHtml).toContain('data-marketplace-action="contact"');
    expect(contactHtml).toContain('/foretag/marketplace-company/tjanster/frisor#kontaktforfragan');
    expect(contactHtml).not.toContain('data-marketplace-action="book"');

    const directoryHtml = renderResult();
    expect(directoryHtml).toContain('data-marketplace-action="directory-profile"');
    expect(directoryHtml).toContain('/foretag/listad/directory-company');
    expect(directoryHtml).not.toContain('data-marketplace-action="book"');
    expect(directoryHtml).not.toContain('data-marketplace-action="quote"');
    expect(directoryHtml).not.toContain('data-marketplace-action="contact"');
  });
});

describe("PublicDirectoryProfile redirect behavior", async () => {
  const { PublicDirectoryProfile } = await import("@/components/company-directory/public-directory-profile");

  const baseProfileView = {
    business: {
      id: "profile-1",
      slug: "test-company",
      companyName: "Test Company AB",
      legalForm: "AB",
      organizationStatus: "Aktivt",
      categorySlug: "vvs",
      primarySniLabel: "VVS-arbeten",
      activityDescription: "Description",
      addressLine1: "Test Street 1",
      postalCode: "151 00",
      city: "Södertälje",
      municipality: "Södertälje",
      region: "Stockholm",
      qualityScore: 95,
      officialSource: "bolagsverket",
      sourceUpdatedAt: "2026-08-23T00:00:00.000Z",
      lastCheckedAt: "2026-08-23T00:00:00.000Z",
      media: null,
      contact: {
        entitled: true,
        addressLine1: "Test Street 1",
        phone: "070-123 45 67",
        email: "test@example.se",
        website: "example.se",
        available: { addressLine1: true, phone: true, email: true, website: true },
      },
    },
    extras: {
      services: [],
      serviceAreas: [],
      reputation: null,
    },
    profile: {
      identity: {
        ownershipState: "claimed" as const,
        workspaceSlug: "test-workspace",
      },
      capabilities: {
        richWebsite: false,
        directContact: true,
        onlineBooking: false,
      },
    },
  };

  beforeEach(() => {
    for (const mock of Object.values(profileRedirectMocks)) mock.mockReset();
  });

  it("redirects claimed profiles with rich-website access to the workspace page", async () => {
    const viewWithRichWebsite = {
      ...baseProfileView,
      profile: {
        ...baseProfileView.profile,
        capabilities: {
          ...baseProfileView.profile.capabilities,
          richWebsite: true,
        },
      },
    };

    profileRedirectMocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(viewWithRichWebsite);
    profileRedirectMocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      PublicDirectoryProfile({ slug: "test-company", locale: "sv" })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(profileRedirectMocks.redirect).toHaveBeenCalledWith("/foretag/test-workspace");
    expect(profileRedirectMocks.getPublicBusinessProfileViewForRequest).toHaveBeenCalledWith("test-company");
  });

  it("shows Directory surface for claimed profiles without rich-website access", async () => {
    const viewWithoutRichWebsite = {
      ...baseProfileView,
      profile: {
        ...baseProfileView.profile,
        capabilities: {
          ...baseProfileView.profile.capabilities,
          richWebsite: false,
        },
      },
    };

    profileRedirectMocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(viewWithoutRichWebsite);

    const result = await PublicDirectoryProfile({ slug: "test-company", locale: "sv" });

    expect(profileRedirectMocks.redirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();

    // Render the component to static HTML and verify the company name appears
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Test Company AB");
  });

  it("redirects with English locale parameter when locale is en", async () => {
    const viewWithRichWebsite = {
      ...baseProfileView,
      profile: {
        ...baseProfileView.profile,
        capabilities: {
          ...baseProfileView.profile.capabilities,
          richWebsite: true,
        },
      },
    };

    profileRedirectMocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(viewWithRichWebsite);
    profileRedirectMocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      PublicDirectoryProfile({ slug: "test-company", locale: "en" })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(profileRedirectMocks.redirect).toHaveBeenCalledWith("/foretag/test-workspace?lang=en");
  });

  it("falls back to routing check when view is null and redirects if workspace has website builder", async () => {
    profileRedirectMocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(null);
    profileRedirectMocks.getClaimedDirectoryWorkspaceSlug.mockResolvedValue("claimed-workspace");
    profileRedirectMocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      PublicDirectoryProfile({ slug: "claimed-company", locale: "sv" })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(profileRedirectMocks.getClaimedDirectoryWorkspaceSlug).toHaveBeenCalledWith("claimed-company");
    expect(profileRedirectMocks.redirect).toHaveBeenCalledWith("/foretag/claimed-workspace");
  });

  it("returns notFound when view is null and no workspace slug available", async () => {
    profileRedirectMocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(null);
    profileRedirectMocks.getClaimedDirectoryWorkspaceSlug.mockResolvedValue(null);
    profileRedirectMocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      PublicDirectoryProfile({ slug: "unknown-company", locale: "sv" })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(profileRedirectMocks.notFound).toHaveBeenCalled();
    expect(profileRedirectMocks.redirect).not.toHaveBeenCalled();
  });
});
