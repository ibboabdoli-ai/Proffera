import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import type { SearchCardBusinessProjection } from "@/lib/business-profile-policy";

describe("Directory SearchCard canonical media", () => {
  it("renders canonical photo/logo media and rejects category illustrations", () => {
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
      totalCount: 3,
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
          id: "illustration",
          slug: "illustration",
          companyName: "Illustration AB",
          profile: profile("illustration", {
            url: "https://example.com/category-illustration.jpg",
            role: "illustration",
            source: "proffera",
            kind: "category_illustration",
            attribution: "",
          }),
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(PublicDirectoryResults, { locale: "sv", search }),
    );
    const cards = markup.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
    const photoCard = cards.find((card) => card.includes("Photo AB"));
    const logoCard = cards.find((card) => card.includes("Logo AB"));
    const illustrationCard = cards.find((card) => card.includes("Illustration AB"));

    expect(photoCard).toContain('data-search-card-media="true"');
    expect(photoCard).toContain('src="https://example.com/business-photo.jpg"');
    expect(logoCard).toContain('data-search-card-media="true"');
    expect(logoCard).toContain('src="https://example.com/business-logo.png"');
    expect(illustrationCard).toBeTruthy();
    expect(illustrationCard).not.toContain('data-search-card-media="true"');
    expect(markup).not.toContain("https://example.com/category-illustration.jpg");
  });
});
