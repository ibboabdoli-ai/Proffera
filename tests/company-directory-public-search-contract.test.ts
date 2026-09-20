import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import type { SearchCardBusinessProjection } from "@/lib/business-profile-policy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public company directory search contract", () => {
  const searchSource = source("src/lib/company-directory-public-search.ts");
  const pageSource = source("src/app/foretag/listad/page.tsx");
  const shellSource = source("src/components/company-directory/public-directory-search-page.tsx");
  const resultsSource = source("src/components/company-directory/public-directory-results.tsx");
  const formSource = source("src/components/company-directory/public-directory-search-form.tsx");
  const copySource = source("src/components/company-directory/public-directory-copy.ts");

  it("never exposes ready or authority-stale published profiles through public search", () => {
    expect(searchSource).toContain("profile.publication_status = 'published'");
    expect(searchSource).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(searchSource).toContain("profile.organization_kind = 'juridical_person'");
    expect(searchSource).toContain("published_facts.source_payload_hash <> ''");
    expect(searchSource).toContain("published_facts.last_synced_at >= profile.last_synced_at");
    expect(searchSource).toContain("published_scb.last_synced_at >= now() - interval '7 days'");
    expect(searchSource).toContain("published_scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text");
    expect(searchSource).toContain("published_scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = published_facts.last_synced_at::text");
    expect(searchSource).toContain("jsonb_array_length(published_scb.conflicts) = 0");
    expect(searchSource).toContain("jsonb_array_length(published_scb.workplaces) = 1");
    expect(searchSource).toContain("profile.is_active = true");
    expect(searchSource).toContain("profile.privacy_blocked = false");
  });

  it("uses canonical service relations and source-qualified physical coordinates", () => {
    expect(searchSource).toContain("company_directory_profile_services");
    expect(searchSource).toContain("relation.public_visible = true");
    expect(searchSource).toContain("company_directory_services");
    expect(searchSource).toContain("company_directory_business_locations");
    expect(searchSource).toContain("location.is_public = true");
    expect(searchSource).toContain("company_directory_profile_locations");
    expect(searchSource).toContain("owner.owner_workspace_id = profile.claimed_workspace_id");
    expect(searchSource).toContain("owner.source_type = 'owner'");
    expect(searchSource).toContain("owner.is_primary = true");
    expect(searchSource).toContain("when owner_location.owner_exact_public then owner_location.latitude");
    expect(searchSource).toContain("when location_choice.use_scb_workplace then location.latitude::float8");
    expect(searchSource).toContain("public_coordinate.latitude is not null");
  });

  it("keeps exact city search usable while preferring owner location or one conflict-free SCB workplace", () => {
    expect(searchSource).toContain("company_directory_scb_enrichment");
    expect(searchSource).toContain("scb_location.conflicts = '[]'::jsonb");
    expect(searchSource).toContain("jsonb_array_length(coalesce(scb_location.workplaces, '[]'::jsonb)) = 1");
    expect(searchSource).toContain("owner_location.id is null");
    expect(searchSource).toContain("owner_location.visibility = 'approximate'");
    expect(searchSource).toContain("owner_location.owner_exact_public");
    expect(searchSource).toContain("claimed_workspace.status in ('active', 'trial')");
    expect(searchSource).toContain("claimed_facts.last_synced_at >= profile.last_synced_at");
    expect(searchSource).toContain("claimed_scb.last_synced_at >= now() - interval '7 days'");
    expect(searchSource).toContain("claimed_scb.last_synced_at >= profile.last_synced_at");
    expect(searchSource).not.toContain("claimed_scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text");
    expect(searchSource).toContain("comparisonSnapshot,officialFactsLastSyncedToken");
    expect(searchSource).toContain("profile.organization_kind = 'sole_trader'");
    expect(searchSource).toContain("bolagsverket_vardefulla_datamangder:sole_trader_owner");
    expect(searchSource).toContain("owner_claim.status = 'claimed'");
    expect(searchSource).toContain("owner_claim.verification_method = 'manual_review'");
    expect(searchSource).toContain("owner_base.purpose = 'service_base'");
    expect(searchSource).toContain("owner_base.geocode_source = 'lantmateriet_belagenhetsadress_v4_2'");
    expect(searchSource).toContain("owner_base.geocode_precision = 'address'");
    expect(searchSource).toContain("lower(btrim(owner_base.city)) = any");
    expect(searchSource).not.toContain("lower(btrim(owner_base.municipality)) = any");
    expect(searchSource).toContain("claimed_facts.deregistration_date is null");
    expect(searchSource).toContain("coalesce(claimed_facts.advertising_blocked, false) = false");
    expect(searchSource).toContain("jsonb_typeof(claimed_facts.ongoing_procedures) = 'array'");
    expect(searchSource).toContain("jsonb_typeof(claimed_scb.conflicts) = 'array'");
    expect(searchSource).toContain("jsonb_typeof(claimed_scb.workplaces) = 'array'");
    expect(searchSource).toContain("DIRECTORY_PILOT_LOCATIONS");
    expect(searchSource).toContain("when owner_location.id is not null then ''");
    expect(searchSource).toContain("or lower(public_location.city) = ${normalizedLocation}");
    expect(searchSource).toContain("or lower(public_location.municipality) = ${normalizedLocation}");
    expect(searchSource).toContain("${nearbyEnabled} = false");
    expect(searchSource).not.toContain("lower(profile.address_line1) not like 'box %'");
  });

  it("keeps nearby radius filtering separate from confirmed service-area evidence", () => {
    expect(searchSource).toContain("distance_km <= ${radiusKm}");
    expect(searchSource).toContain("6371 * 2 * asin");
    expect(searchSource).toContain("company_directory_service_areas");
    expect(searchSource).toContain("area.public_visible = true");
    expect(searchSource).toContain("area.confirmed_at is not null");
    expect(searchSource).toContain("area.radius_km between 1 and 300");
    expect(searchSource).toContain("area.service_slug = relation.service_slug or area.service_slug is null");
    expect(searchSource).toContain("case when area.service_slug = relation.service_slug then 0 else 1 end");
    expect(searchSource).toContain("confirmedCompanyDirectoryServiceAreaCoversSearch");
    expect(searchSource).toContain("const servesNearbyLocation = nearbyEnabled && serviceAreaCoversSearch");
    expect(resultsSource).toContain("result.servesNearbyLocation");
    expect(copySource).toContain("Bekräftat serviceområde");
    expect(copySource).toContain("Confirmed service area");
  });

  it("adds autocomplete, nearby search, popular services and customer-focused result cards", () => {
    expect(pageSource).toContain('PublicDirectorySearchPage locale="sv"');
    expect(shellSource).toContain("PublicDirectorySearchForm");
    expect(shellSource).toContain("popularDirectoryServices");
    expect(resultsSource).not.toContain("result.activityDescription");
    expect(resultsSource).toContain("t.verifiedDetails");
    expect(resultsSource).toContain("registeredLocation(result, locale)");
    expect(resultsSource).toContain("result.distanceKm");
    expect(copySource).toContain("toFixed(1)");
    expect(formSource).toContain("directory-service-suggestions");
    expect(formSource).toContain("directory-location-suggestions");
    expect(formSource).toContain("navigator.geolocation.getCurrentPosition");
    expect(copySource).toContain("Nära mig");
  });

  it("renders only trusted SearchCard media and verified reputation when hydration provides them", () => {
    const baseResult = {
      categorySlug: "malare",
      matchedServiceSlug: "malare",
      matchedServiceLabel: "Målare",
      activityDescription: "",
      addressLine1: "",
      postalCode: "",
      city: "Södertälje",
      municipality: "Södertälje",
      qualityScore: 100,
      distanceKm: null,
      serviceAreaRadiusKm: null,
      servesNearbyLocation: false,
      claimedWorkspaceSlug: null,
      claimedServiceId: null,
      claimedServiceSlug: null,
      claimedBookingSlug: null,
      conversionMode: null,
      bookingAvailable: false,
    } as const;

    const search = {
      serviceQuery: "målare",
      locationQuery: "Södertälje",
      serviceResolved: true,
      nearbyRequested: false,
      nearbyEnabled: false,
      radiusKm: 25,
      totalCount: 3,
      page: 1,
      pageSize: 30,
      totalPages: 1,
      results: [
        {
          ...baseResult,
          id: "trusted",
          slug: "trusted",
          companyName: "Trusted AB",
          profile: {
            profileId: "trusted",
            directorySlug: "trusted",
            workspaceSlug: null,
            displayName: "Trusted AB",
            categorySlug: "malare",
            city: "Södertälje",
            municipality: "Södertälje",
            media: {
              url: "https://example.com/trusted.jpg",
              role: "business_photo",
              source: "proffera",
              kind: "image",
              attribution: "",
            },
            canonicalServiceSlugs: ["malare"],
            reputation: { rating: 4.8, verifiedReviews: 2 },
            capabilities: { richWebsite: false, onlineBooking: false, mediatedQuote: true },
          } satisfies SearchCardBusinessProjection,
        },
        {
          ...baseResult,
          id: "illustration",
          slug: "illustration",
          companyName: "Illustration AB",
          profile: {
            profileId: "illustration",
            directorySlug: "illustration",
            workspaceSlug: null,
            displayName: "Illustration AB",
            categorySlug: "malare",
            city: "Södertälje",
            municipality: "Södertälje",
            media: {
              url: "https://example.com/illustration.jpg",
              role: "illustration",
              source: "proffera",
              kind: "image",
              attribution: "",
            },
            canonicalServiceSlugs: ["malare"],
            reputation: null,
            capabilities: { richWebsite: false, onlineBooking: false, mediatedQuote: true },
          } satisfies SearchCardBusinessProjection,
        },
        {
          ...baseResult,
          id: "zero-review",
          slug: "zero-review",
          companyName: "Zero Review AB",
          profile: {
            profileId: "zero-review",
            directorySlug: "zero-review",
            workspaceSlug: null,
            displayName: "Zero Review AB",
            categorySlug: "malare",
            city: "Södertälje",
            municipality: "Södertälje",
            media: null,
            canonicalServiceSlugs: ["malare"],
            reputation: { rating: 5, verifiedReviews: 0 },
            capabilities: { richWebsite: false, onlineBooking: false, mediatedQuote: true },
          } satisfies SearchCardBusinessProjection,
        },
      ],
    };

    const svMarkup = renderToStaticMarkup(createElement(PublicDirectoryResults, { locale: "sv", search }));
    const enMarkup = renderToStaticMarkup(createElement(PublicDirectoryResults, { locale: "en", search }));
    const svCards = svMarkup.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
    const enCards = enMarkup.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
    const svTrustedCard = svCards.find((card) => card.includes("Trusted AB"));
    const svZeroReviewCard = svCards.find((card) => card.includes("Zero Review AB"));
    const enZeroReviewCard = enCards.find((card) => card.includes("Zero Review AB"));

    expect(svTrustedCard).toBeTruthy();
    expect(svTrustedCard).toContain('data-search-card-media="true"');
    expect(svTrustedCard).toContain('src="https://example.com/trusted.jpg"');
    expect(svTrustedCard).toContain('data-search-card-reputation="true"');
    expect(svTrustedCard).toContain("4.8");
    expect(svTrustedCard).toContain("2 verifierade omdömen");
    expect(svMarkup).not.toContain("https://example.com/illustration.jpg");
    expect(enMarkup).toContain("2 verified reviews");
    expect(svZeroReviewCard).toBeTruthy();
    expect(svZeroReviewCard).not.toContain('data-search-card-reputation="true"');
    expect(svZeroReviewCard).not.toMatch(/verifierat omdöme|verifierade omdömen/);
    expect(enZeroReviewCard).toBeTruthy();
    expect(enZeroReviewCard).not.toContain('data-search-card-reputation="true"');
    expect(enZeroReviewCard).not.toMatch(/verified review|verified reviews/);
  });

  it("keeps search and profile routing in the shared public directory graph", () => {
    expect(shellSource).toContain("searchPublishedBusinessProfiles");
    expect(resultsSource).toContain("${profileBase}/${encodeURIComponent(result.slug)}");
    expect(copySource).toContain("verksamhetsplats");
    expect(copySource).toContain("operating location");
    expect(copySource).not.toContain("registrerade ort");
    expect(copySource).toContain("Bekräftat serviceområde visas separat");
    expect(copySource).toContain('search: "/foretag/listad"');
    expect(copySource).toContain('search: "/en/companies"');
  });
});
