import { describe, expect, it } from "vitest";

import {
  projectBusinessProfileMarketplaceProvider,
  projectBusinessProfilePublicProfile,
  projectBusinessProfileSearchCard,
  projectBusinessProfileSeo,
  resolveBusinessProfilePolicy,
  type BusinessProfileResolveInput,
} from "../src/lib/business-profile-policy";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";

function input(overrides: Partial<BusinessProfileResolveInput> = {}): BusinessProfileResolveInput {
  const base: BusinessProfileResolveInput = {
    official: {
      profileId: PROFILE_ID,
      directorySlug: "official-company-ab",
      claimedWorkspaceId: null,
      legalName: "Official Company AB",
      displayName: "Official Company AB",
      legalForm: "AB",
      organizationStatus: "Aktivt",
      organizationNumber: "5560000000",
      categorySlug: "vvs",
      primarySniCode: "43.221",
      primarySniLabel: "VVS-arbeten",
      activityDescription: "Officiell verksamhetsbeskrivning",
      publicLocation: {
        addressLine1: "",
        postalCode: "151 00",
        city: "Södertälje",
        municipality: "Södertälje",
      },
      media: {
        url: "/directory/category-vvs.png",
        kind: "illustration",
        attribution: "Proffera",
        isActualBusinessMedia: false,
      },
    },
    directoryServices: [
      { slug: "vvs", label: "VVS / Rörmokare", confirmed: false },
      { slug: "avloppsrensning", label: "Avloppsrensning", confirmed: true },
    ],
    serviceAreas: [
      { serviceSlug: "avloppsrensning", serviceLabel: "Avloppsrensning", radiusKm: 25 },
    ],
    reputation: {
      rating: 4.8,
      verifiedReviews: 12,
      completedJobs: 24,
      customerCancellations: 1,
      providerCancellations: 2,
      noShows: 0,
      problemJobs: 1,
    },
    publicContact: {
      entitled: false,
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
      available: {
        addressLine1: true,
        phone: true,
        email: true,
        website: true,
      },
    },
  };

  return {
    ...base,
    ...overrides,
    official: { ...base.official, ...(overrides.official ?? {}) },
  };
}

function claimedInput(entitled = true): BusinessProfileResolveInput {
  return input({
    official: {
      ...input().official,
      claimedWorkspaceId: WORKSPACE_ID,
      media: {
        url: "/directory/real-business.jpg",
        kind: "image",
        attribution: "Company source",
        isActualBusinessMedia: true,
      },
    },
    owner: {
      workspaceId: WORKSPACE_ID,
      workspaceSlug: "owner-company",
      bookingSlug: "owner-company-booking",
      companyName: "Owner Brand",
      businessIntro: "Ägarens verifierade presentation",
      logoUrl: "/owner/logo.png",
      heroImageUrl: "/owner/hero.jpg",
      featuredMediaUrl: "/owner/featured.jpg",
      services: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          name: "Akut VVS",
          description: "Jour och akuta VVS-jobb",
          publicSlug: "akut-vvs-sodertalje",
          canonicalServiceSlug: "vvs",
          conversionMode: "quote",
        },
      ],
    },
    entitlements: {
      workspaceId: WORKSPACE_ID,
      directContact: entitled,
      richWebsite: entitled,
      onlineBooking: entitled,
    },
    publicContact: {
      entitled,
      addressLine1: entitled ? "Ägarvägen 1" : "",
      phone: entitled ? "070-123 45 67" : "",
      email: entitled ? "hej@example.se" : "",
      website: entitled ? "example.se" : "",
      available: {
        addressLine1: true,
        phone: true,
        email: true,
        website: true,
      },
    },
  });
}

describe("BusinessProfilePolicy", () => {
  it("keeps official legal truth and excludes unconfirmed Directory service suggestions", () => {
    const profile = resolveBusinessProfilePolicy(input());

    expect(profile.identity.ownershipState).toBe("unclaimed");
    expect(profile.legal.legalName).toBe("Official Company AB");
    expect(profile.presentation.displayName).toEqual({ value: "Official Company AB", source: "official" });
    expect(profile.services).toEqual([
      expect.objectContaining({
        canonicalServiceSlug: "avloppsrensning",
        name: "Avloppsrensning",
        source: "proffera",
      }),
    ]);
    expect(profile.services.some((service) => service.canonicalServiceSlug === "vvs")).toBe(false);
    expect(profile.capabilities).toEqual({
      directContact: false,
      richWebsite: false,
      onlineBooking: false,
      mediatedQuote: true,
    });
  });

  it("lets the verified claimed Workspace own presentation and exact services without overwriting legal identity", () => {
    const profile = resolveBusinessProfilePolicy(claimedInput(true));

    expect(profile.identity).toMatchObject({
      ownershipState: "claimed",
      claimedWorkspaceId: WORKSPACE_ID,
      workspaceSlug: "owner-company",
      bookingSlug: "owner-company-booking",
    });
    expect(profile.legal.legalName).toBe("Official Company AB");
    expect(profile.presentation.displayName).toEqual({ value: "Owner Brand", source: "owner" });
    expect(profile.presentation.description).toEqual({
      value: "Ägarens verifierade presentation",
      source: "owner",
    });
    expect(profile.presentation.media).toMatchObject({
      url: "/owner/hero.jpg",
      role: "hero",
      source: "owner",
    });
    expect(profile.services).toEqual([
      expect.objectContaining({
        id: "44444444-4444-4444-8444-444444444444",
        name: "Akut VVS",
        canonicalServiceSlug: "vvs",
        publicSlug: "akut-vvs-sodertalje",
        conversionMode: "quote",
        source: "owner",
      }),
    ]);
    expect(profile.contact.phone).toBe("070-123 45 67");
    expect(profile.capabilities.directContact).toBe(true);
  });

  it("treats downgrade as a capability change and preserves business truth, services, media and reputation", () => {
    const entitled = resolveBusinessProfilePolicy(claimedInput(true));
    const free = resolveBusinessProfilePolicy(claimedInput(false));

    expect(free.identity.claimedWorkspaceId).toBe(entitled.identity.claimedWorkspaceId);
    expect(free.presentation).toEqual(entitled.presentation);
    expect(free.legal).toEqual(entitled.legal);
    expect(free.services).toEqual(entitled.services);
    expect(free.serviceAreas).toEqual(entitled.serviceAreas);
    expect(free.reputation).toEqual(entitled.reputation);
    expect(free.capabilities).toEqual({
      directContact: false,
      richWebsite: false,
      onlineBooking: false,
      mediatedQuote: true,
    });
    expect(free.contact).toMatchObject({
      entitled: false,
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
    });
    expect(free.contact.available).toEqual(entitled.contact.available);

    const freeProjection = projectBusinessProfilePublicProfile(free);
    expect(freeProjection.workspaceSlug).toBeNull();
    expect(freeProjection.bookingSlug).toBeNull();
    expect(freeProjection.displayName).toBe("Owner Brand");
    expect(freeProjection.services[0]?.canonicalServiceSlug).toBe("vvs");
  });

  it("ignores owner and entitlement data that do not belong to the claimed Workspace", () => {
    const candidate = claimedInput(true);
    candidate.owner = {
      ...candidate.owner!,
      workspaceId: OTHER_WORKSPACE_ID,
      companyName: "Wrong Tenant Brand",
      services: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          name: "Wrong Tenant Service",
          description: "",
          publicSlug: "wrong-tenant",
          canonicalServiceSlug: "vvs",
          conversionMode: "quote",
        },
      ],
    };
    candidate.entitlements = {
      workspaceId: OTHER_WORKSPACE_ID,
      directContact: true,
      richWebsite: true,
      onlineBooking: true,
    };

    const profile = resolveBusinessProfilePolicy(candidate);

    expect(profile.presentation.displayName).toEqual({ value: "Official Company AB", source: "official" });
    expect(profile.identity.workspaceSlug).toBeNull();
    expect(profile.services.some((service) => service.name === "Wrong Tenant Service")).toBe(false);
    expect(profile.services[0]?.canonicalServiceSlug).toBe("avloppsrensning");
    expect(profile.capabilities).toEqual({
      directContact: false,
      richWebsite: false,
      onlineBooking: false,
      mediatedQuote: true,
    });
    expect(profile.contact.phone).toBe("");
  });

  it("uses role-specific media precedence without making paid access the owner of factual media", () => {
    const candidate = claimedInput(false);
    candidate.owner = {
      ...candidate.owner!,
      heroImageUrl: "",
      featuredMediaUrl: "",
    };

    const profile = resolveBusinessProfilePolicy(candidate);
    expect(profile.presentation.media).toMatchObject({
      url: "/directory/real-business.jpg",
      role: "business_photo",
      source: "proffera",
    });

    candidate.official = {
      ...candidate.official,
      media: {
        url: "/directory/category-vvs.png",
        kind: "illustration",
        attribution: "Proffera",
        isActualBusinessMedia: false,
      },
    };
    const logoFallback = resolveBusinessProfilePolicy(candidate);
    expect(logoFallback.presentation.media).toMatchObject({
      url: "/owner/logo.png",
      role: "logo",
      source: "owner",
    });
  });

  it("keeps SearchCard and SEO public-safe while MarketplaceProvider retains matching-only operational signals", () => {
    const profile = resolveBusinessProfilePolicy(claimedInput(true));
    const card = projectBusinessProfileSearchCard(profile);
    const seo = projectBusinessProfileSeo(profile);
    const provider = projectBusinessProfileMarketplaceProvider(profile);

    expect("contact" in card).toBe(false);
    expect("addressLine1" in card).toBe(false);
    expect(card).toMatchObject({
      profileId: PROFILE_ID,
      workspaceSlug: "owner-company",
      canonicalServiceSlugs: ["vvs"],
      reputation: { rating: 4.8, verifiedReviews: 12 },
    });
    expect(seo.streetAddress).toBe("Ägarvägen 1");
    expect(seo.contact).toEqual({
      phone: "070-123 45 67",
      email: "hej@example.se",
      website: "example.se",
    });
    expect(provider.services).toEqual([
      {
        workspaceServiceId: "44444444-4444-4444-8444-444444444444",
        canonicalServiceSlug: "vvs",
        conversionMode: "quote",
      },
    ]);
    expect(provider.reputation).toMatchObject({
      customerCancellations: 1,
      providerCancellations: 2,
      problemJobs: 1,
    });

    const downgradedSeo = projectBusinessProfileSeo(resolveBusinessProfilePolicy(claimedInput(false)));
    expect(downgradedSeo.streetAddress).toBe("");
    expect(downgradedSeo.contact).toEqual({ phone: "", email: "", website: "" });
  });
});
