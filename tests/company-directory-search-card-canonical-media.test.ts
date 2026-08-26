import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import type { SearchCardBusinessProjection } from "@/lib/business-profile-policy";

describe("Directory SearchCard canonical media", () => {
  it("renders canonical photo/logo media and fails closed for rejected media combinations", () => {
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

    function profile(
      id: string,
      media: SearchCardBusinessProjection["media"],
    ): SearchCardBusinessProjection {
      return {
        profileId: id,
        directorySlug: id,
        workspaceSlug: null,
        displayName: id,
        categorySlug: "malare",
        city: "Södertälje",
        municipality: "Södertälje",
        media,
        canonicalServiceSlugs: ["malare"],
        reputation: null,
        capabilities: { richWebsite: false, onlineBooking: false, mediatedQuote: true },
      };
    }

    const search = {
      serviceQuery: "målare",
      locationQuery: "Södertälje",
      serviceResolved: true,
      nearbyRequested: false,
      nearbyEnabled: false,
      radiusKm: 25,
      totalCount: 5,
      page: 1,
      pageSize: 30,
      totalPages: 1,
      results: [
        {
          ...baseResult,
          id: "photo",
          slug: "photo",
          companyName: "Photo AB",
          profile: profile("photo", {
            url: "https://example.com/business-photo.jpg",
            role: "business_photo",
            source: "proffera",
            kind: "photo",
            attribution: "",
          }),
        },
        {
          ...baseResult,
          id: "logo",
          slug: "logo",
          companyName: "Logo AB",
          profile: profile("logo", {
            url: "https://example.com/business-logo.png",
            role: "business_photo",
            source: "proffera",
            kind: "logo",
            attribution: "",
          }),
        },
        {
          ...baseResult,
          id: "illustration-role",
          slug: "illustration-role",
          companyName: "Illustration Role AB",
          profile: profile("illustration-role", {
            url: "https://example.com/illustration-role.jpg",
            role: "illustration",
            source: "proffera",
            kind: "photo",
            attribution: "",
          }),
        },
        {
          ...baseResult,
          id: "category-kind",
          slug: "category-kind",
          companyName: "Category Kind AB",
          profile: profile("category-kind", {
            url: "https://example.com/category-kind.jpg",
            role: "business_photo",
            source: "proffera",
            kind: "category_illustration",
            attribution: "",
          }),
        },
        {
          ...baseResult,
          id: "unknown-kind",
          slug: "unknown-kind",
          companyName: "Unknown Kind AB",
          profile: profile("unknown-kind", {
            url: "https://example.com/unknown-kind.jpg",
            role: "business_photo",
            source: "proffera",
            kind: "unknown_future_kind",
            attribution: "",
          }),
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(PublicDirectoryResults, { locale: "sv", search }),
    );
    const cards = markup.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
    const cardFor = (companyName: string) => cards.find((card) => card.includes(companyName));
    const photoCard = cardFor("Photo AB");
    const logoCard = cardFor("Logo AB");

    expect(photoCard).toContain('data-search-card-media="true"');
    expect(photoCard).toContain('src="https://example.com/business-photo.jpg"');
    expect(logoCard).toContain('data-search-card-media="true"');
    expect(logoCard).toContain('src="https://example.com/business-logo.png"');

    for (const companyName of ["Illustration Role AB", "Category Kind AB", "Unknown Kind AB"]) {
      const card = cardFor(companyName);
      expect(card).toBeTruthy();
      expect(card).not.toContain('data-search-card-media="true"');
    }

    expect(markup).not.toContain("https://example.com/illustration-role.jpg");
    expect(markup).not.toContain("https://example.com/category-kind.jpg");
    expect(markup).not.toContain("https://example.com/unknown-kind.jpg");
  });
});
