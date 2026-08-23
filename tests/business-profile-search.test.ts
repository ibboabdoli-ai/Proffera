import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  access: vi.fn(),
  searchDirectory: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSql: () => mocks.sql,
}));

vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.access,
}));

vi.mock("@/lib/company-directory-public-search", () => ({
  searchPublishedCompanyDirectory: mocks.searchDirectory,
}));

import {
  applyBusinessProfileSearchCard,
  hydratePublishedDirectorySearchWithBusinessProfiles,
  searchPublishedBusinessProfiles,
} from "@/lib/business-profile-search";
import type { SearchCardBusinessProjection } from "@/lib/business-profile-policy";
import type {
  PublishedDirectorySearchInput,
  PublishedDirectorySearchResponse,
  PublishedDirectorySearchResult,
} from "@/lib/company-directory-public-search";

const PROFILE_A = "11111111-1111-4111-8111-111111111111";
const PROFILE_B = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function result(overrides: Partial<PublishedDirectorySearchResult> = {}): PublishedDirectorySearchResult {
  return {
    id: PROFILE_A,
    slug: "alpha-vvs",
    companyName: "Alpha VVS AB",
    categorySlug: "vvs",
    matchedServiceSlug: "vvs",
    matchedServiceLabel: "VVS",
    activityDescription: "Official activity",
    addressLine1: "",
    postalCode: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
    qualityScore: 96,
    distanceKm: 3.2,
    serviceAreaRadiusKm: 25,
    servesNearbyLocation: true,
    claimedWorkspaceSlug: "alpha-workspace",
    claimedServiceId: "33333333-3333-4333-8333-333333333333",
    claimedServiceSlug: "custom-vvs",
    claimedBookingSlug: "alpha-booking",
    conversionMode: "book_or_quote",
    bookingAvailable: true,
    ...overrides,
  };
}

function response(results: PublishedDirectorySearchResult[]): PublishedDirectorySearchResponse {
  return {
    serviceQuery: "vvs",
    locationQuery: "Södertälje",
    serviceResolved: true,
    nearbyRequested: false,
    nearbyEnabled: false,
    radiusKm: 25,
    results,
    totalCount: results.length,
    page: 1,
    pageSize: 30,
    totalPages: results.length ? 1 : 0,
  };
}

function unclaimedResult() {
  return result({
    id: PROFILE_B,
    slug: "beta-vvs",
    companyName: "Beta VVS AB",
    claimedWorkspaceSlug: null,
    claimedServiceId: null,
    claimedServiceSlug: null,
    claimedBookingSlug: null,
    conversionMode: null,
    bookingAvailable: false,
  });
}

function configureUnclaimedHydrationSql(reputationError?: Error & { code?: string }) {
  mocks.sql.mockImplementation((strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("featured_media.public_url")) {
      return Promise.resolve([
        {
          profile_id: PROFILE_B,
          claimed_workspace_id: null,
          legal_name: "Beta VVS AB",
          legal_form: "AB",
          organization_status: "active",
          organization_number: "5590000002",
          primary_sni_code: "43.221",
          primary_sni_label: "VVS",
          owner_workspace_id: null,
          workspace_slug: "",
          public_booking_slug: "",
          company_name: "",
          business_intro: "",
          logo_url: "",
          hero_image_url: "",
          featured_media_url: "",
          directory_media_url: "https://cdn.example/beta-real.jpg",
          directory_media_kind: "image",
          directory_media_attribution: "",
          directory_media_actual: true,
        },
      ]);
    }
    if (query.includes("join workspace_services service")) return Promise.resolve([]);
    if (query.includes("join company_directory_profile_services relation")) return Promise.resolve([]);
    if (query.includes("join marketplace_profile_reputation reputation")) {
      return reputationError ? Promise.reject(reputationError) : Promise.resolve([]);
    }
    throw new Error(`Unexpected query: ${query}`);
  });
  mocks.access.mockResolvedValue(new Map());
}

describe("BusinessProfile Search projection", () => {
  beforeEach(() => {
    mocks.sql.mockReset();
    mocks.access.mockReset();
    mocks.searchDirectory.mockReset();
  });

  it("uses the SearchCard projection for presentation while capability downgrade disables direct marketplace actions", () => {
    const base = result();
    const paidCard: SearchCardBusinessProjection = {
      profileId: PROFILE_A,
      directorySlug: base.slug,
      workspaceSlug: "alpha-workspace",
      displayName: "Alpha Rör & Värme",
      categorySlug: "vvs",
      city: "Södertälje",
      municipality: "Södertälje",
      media: {
        url: "https://cdn.example/hero.jpg",
        role: "hero",
        source: "owner",
        kind: "image",
        attribution: "",
      },
      canonicalServiceSlugs: ["vvs"],
      reputation: { rating: 4.8, verifiedReviews: 17 },
      capabilities: { richWebsite: true, onlineBooking: true, mediatedQuote: true },
    };

    const paid = applyBusinessProfileSearchCard(base, paidCard);
    expect(paid.companyName).toBe("Alpha Rör & Värme");
    expect(paid.claimedWorkspaceSlug).toBe("alpha-workspace");
    expect(paid.bookingAvailable).toBe(true);
    expect(paid.profile.media?.role).toBe("hero");
    expect(paid.profile.reputation).toEqual({ rating: 4.8, verifiedReviews: 17 });
    expect("contact" in paid.profile).toBe(false);
    expect("addressLine1" in paid.profile).toBe(false);

    const free = applyBusinessProfileSearchCard(base, {
      ...paidCard,
      workspaceSlug: null,
      capabilities: { richWebsite: false, onlineBooking: false, mediatedQuote: true },
    });
    expect(free.companyName).toBe("Alpha Rör & Värme");
    expect(free.profile.canonicalServiceSlugs).toEqual(["vvs"]);
    expect(free.profile.reputation).toEqual({ rating: 4.8, verifiedReviews: 17 });
    expect(free.claimedWorkspaceSlug).toBeNull();
    expect(free.claimedServiceId).toBeNull();
    expect(free.claimedServiceSlug).toBeNull();
    expect(free.conversionMode).toBeNull();
    expect(free.bookingAvailable).toBe(false);
  });

  it("hydrates a page in a bounded batch instead of one owner/reputation query per result", async () => {
    const first = result();
    const second = unclaimedResult();

    mocks.sql.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("featured_media.public_url")) {
        return Promise.resolve([
          {
            profile_id: PROFILE_A,
            claimed_workspace_id: WORKSPACE_A,
            legal_name: "Alpha VVS AB",
            legal_form: "AB",
            organization_status: "active",
            organization_number: "5590000001",
            primary_sni_code: "43.221",
            primary_sni_label: "VVS",
            owner_workspace_id: WORKSPACE_A,
            workspace_slug: "alpha-workspace",
            public_booking_slug: "alpha-booking",
            company_name: "Alpha Rör & Värme",
            business_intro: "Owner intro",
            logo_url: "https://cdn.example/logo.png",
            hero_image_url: "https://cdn.example/hero.jpg",
            featured_media_url: "",
            directory_media_url: "https://cdn.example/directory.jpg",
            directory_media_kind: "image",
            directory_media_attribution: "",
            directory_media_actual: true,
          },
          {
            profile_id: PROFILE_B,
            claimed_workspace_id: null,
            legal_name: "Beta VVS AB",
            legal_form: "AB",
            organization_status: "active",
            organization_number: "5590000002",
            primary_sni_code: "43.221",
            primary_sni_label: "VVS",
            owner_workspace_id: null,
            workspace_slug: "",
            public_booking_slug: "",
            company_name: "",
            business_intro: "",
            logo_url: "",
            hero_image_url: "",
            featured_media_url: "",
            directory_media_url: "https://cdn.example/beta-illustration.jpg",
            directory_media_kind: "image",
            directory_media_attribution: "Illustrationsbild",
            directory_media_actual: false,
          },
        ]);
      }
      if (query.includes("join workspace_services service")) {
        return Promise.resolve([
          {
            profile_id: PROFILE_A,
            id: "33333333-3333-4333-8333-333333333333",
            name: "Rörservice",
            description: "Owner service",
            public_slug: "custom-vvs",
            primary_directory_service_slug: "vvs",
            conversion_mode: "book_or_quote",
          },
        ]);
      }
      if (query.includes("join company_directory_profile_services relation")) {
        return Promise.resolve([
          { profile_id: PROFILE_A, slug: "vvs", label: "VVS", confirmed_at: "2026-08-23T00:00:00Z" },
          { profile_id: PROFILE_B, slug: "vvs", label: "VVS", confirmed_at: null },
        ]);
      }
      if (query.includes("join marketplace_profile_reputation reputation")) {
        return Promise.resolve([
          {
            profile_id: PROFILE_A,
            rating: 4.9,
            verified_review_count: 12,
            completed_jobs: 20,
            customer_cancelled_jobs: 1,
            provider_cancelled_jobs: 0,
            no_show_jobs: 0,
            problem_jobs: 0,
          },
        ]);
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    mocks.access.mockResolvedValue(new Map([
      [WORKSPACE_A, { planAccess: true, websiteBuilder: true, onlineBooking: true }],
    ]));

    const hydrated = await hydratePublishedDirectorySearchWithBusinessProfiles(response([first, second]));

    expect(mocks.sql).toHaveBeenCalledTimes(4);
    expect(mocks.access).toHaveBeenCalledTimes(1);
    expect(mocks.access).toHaveBeenCalledWith([WORKSPACE_A]);
    expect(hydrated.results).toHaveLength(2);
    expect(hydrated.results[0].companyName).toBe("Alpha Rör & Värme");
    expect(hydrated.results[0].profile.media?.url).toBe("https://cdn.example/hero.jpg");
    expect(hydrated.results[0].profile.canonicalServiceSlugs).toEqual(["vvs"]);
    expect(hydrated.results[0].profile.reputation).toEqual({ rating: 4.9, verifiedReviews: 12 });
    expect(hydrated.results[0].claimedWorkspaceSlug).toBe("alpha-workspace");
    expect(hydrated.results[0].claimedServiceId).toBe("33333333-3333-4333-8333-333333333333");
    expect(hydrated.results[0].claimedServiceSlug).toBe("custom-vvs");
    expect(hydrated.results[0].conversionMode).toBe("book_or_quote");
    expect(hydrated.results[0].bookingAvailable).toBe(true);
    expect(hydrated.results[1].companyName).toBe("Beta VVS AB");
    expect(hydrated.results[1].profile.media?.role).toBe("illustration");
    expect(hydrated.results[1].profile.canonicalServiceSlugs).toEqual([]);
    expect(hydrated.results[1].claimedWorkspaceSlug).toBeNull();
    expect(hydrated.results[1].claimedServiceId).toBeNull();
    expect(hydrated.results[1].claimedServiceSlug).toBeNull();
    expect(hydrated.results[1].conversionMode).toBeNull();
    expect(hydrated.results[1].bookingAvailable).toBe(false);
  });

  it("falls back every result when a required batch query rejects", async () => {
    const first = result();
    const second = unclaimedResult();
    mocks.sql.mockRejectedValueOnce(new Error("context query failed"));
    mocks.sql.mockResolvedValue([]);

    const hydrated = await hydratePublishedDirectorySearchWithBusinessProfiles(response([first, second]));

    expect(hydrated.results).toHaveLength(2);
    expect(hydrated.results[0].profile.displayName).toBe(first.companyName);
    expect(hydrated.results[0].profile.media).toBeNull();
    expect(hydrated.results[1].profile.displayName).toBe(second.companyName);
    expect(hydrated.results[1].profile.media).toBeNull();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it.each(["42P01", "42703"])("tolerates optional reputation schema error %s", async (code) => {
    const error = Object.assign(new Error("optional reputation schema unavailable"), { code });
    configureUnclaimedHydrationSql(error);

    const hydrated = await hydratePublishedDirectorySearchWithBusinessProfiles(response([unclaimedResult()]));

    expect(hydrated.results[0].profile.media?.url).toBe("https://cdn.example/beta-real.jpg");
    expect(hydrated.results[0].profile.reputation).toBeNull();
    expect(mocks.access).toHaveBeenCalledTimes(1);
  });

  it("falls back when reputation hydration fails with an unexpected error", async () => {
    const error = Object.assign(new Error("reputation query failed"), { code: "XX000" });
    configureUnclaimedHydrationSql(error);

    const hydrated = await hydratePublishedDirectorySearchWithBusinessProfiles(response([unclaimedResult()]));

    expect(hydrated.results[0].profile.media).toBeNull();
    expect(hydrated.results[0].profile.reputation).toBeNull();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("forwards the exact Directory input and hydrates the returned response", async () => {
    const input: PublishedDirectorySearchInput = {
      service: "vvs",
      location: "Södertälje",
      radiusKm: "25",
      page: "2",
      limit: 30,
    };
    const directoryResponse = response([result()]);
    mocks.searchDirectory.mockResolvedValue(directoryResponse);
    mocks.sql.mockResolvedValue([]);
    mocks.access.mockResolvedValue(new Map());

    const hydrated = await searchPublishedBusinessProfiles(input);

    expect(mocks.searchDirectory).toHaveBeenCalledTimes(1);
    expect(mocks.searchDirectory).toHaveBeenCalledWith(input);
    expect(hydrated.results).toHaveLength(1);
    expect(hydrated.results[0].profile.profileId).toBe(PROFILE_A);
    expect(hydrated.results[0].profile.displayName).toBe("Alpha VVS AB");
  });
});
