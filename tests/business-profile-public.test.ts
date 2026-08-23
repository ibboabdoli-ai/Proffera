import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusinessForRequest: vi.fn(),
  getPublicDirectoryProfileExtras: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-public-data", () => ({
  getPublicDirectoryBusinessForRequest: mocks.getPublicDirectoryBusinessForRequest,
}));
vi.mock("@/lib/company-directory-public-profile-extras", () => ({
  getPublicDirectoryProfileExtras: mocks.getPublicDirectoryProfileExtras,
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

import {
  getPublicProfileBusinessProjection,
  getResolvedPublicBusinessProfile,
  getSeoBusinessProjection,
} from "../src/lib/business-profile-public";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

function publicBusiness(publicationStatus: "published" | "claimed" = "claimed") {
  return {
    id: PROFILE_ID,
    slug: "official-company-ab",
    companyName: "Directory Display Name",
    legalForm: "AB",
    organizationStatus: "Aktivt",
    categorySlug: "vvs",
    primarySniLabel: "VVS-arbeten",
    activityDescription: "Officiell beskrivning",
    addressLine1: publicationStatus === "claimed" ? "Ägarvägen 1" : "",
    postalCode: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
    region: "Stockholm",
    qualityScore: 98,
    officialSource: "bolagsverket",
    sourceUpdatedAt: "2026-08-23T00:00:00.000Z",
    lastCheckedAt: "2026-08-23T00:00:00.000Z",
    media: {
      url: "/directory/real.jpg",
      kind: "image",
      attribution: "Directory",
      isActualBusinessMedia: true,
    },
    publicationStatus,
    organizationNumber: "5560000000",
    primarySniCode: "43.221",
    contact: {
      entitled: publicationStatus === "claimed",
      addressLine1: publicationStatus === "claimed" ? "Ägarvägen 1" : "",
      phone: publicationStatus === "claimed" ? "070-123 45 67" : "",
      email: publicationStatus === "claimed" ? "hej@example.se" : "",
      website: publicationStatus === "claimed" ? "example.se" : "",
      available: {
        addressLine1: true,
        phone: true,
        email: true,
        website: true,
      },
    },
  };
}

function extras() {
  return {
    services: [
      { slug: "vvs", label: "VVS / Rörmokare", sourceType: "sni", confidence: 0.9, confirmed: false },
      { slug: "avloppsrensning", label: "Avloppsrensning", sourceType: "owner", confidence: 1, confirmed: true },
    ],
    serviceAreas: [{ serviceSlug: "vvs", serviceLabel: "VVS / Rörmokare", radiusKm: 25 }],
    reputation: {
      rating: 4.9,
      verifiedReviews: 8,
      completedJobs: 14,
      customerCancellations: 0,
      providerCancellations: 1,
      noShows: 0,
      problemJobs: 0,
    },
  };
}

describe("single-profile BusinessProfile resolver", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getPublicDirectoryProfileExtras.mockResolvedValue(extras());
  });

  it("hydrates owner truth only through the Directory profile's linked Workspace", async () => {
    mocks.getPublicDirectoryBusinessForRequest.mockResolvedValue(publicBusiness("claimed"));
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("from company_directory_profiles profile")) {
        return [{
          legal_name: "Official Company AB",
          claimed_workspace_id: WORKSPACE_ID,
          owner_workspace_id: WORKSPACE_ID,
          workspace_slug: "owner-company",
          public_booking_slug: "owner-booking",
          company_name: "Owner Brand",
          business_intro: "Owner introduction",
          logo_url: "/owner/logo.png",
          hero_image_url: "/owner/hero.jpg",
          featured_media_url: "/owner/featured.jpg",
        }];
      }
      if (query.includes("from workspace_services service")) {
        return [{
          id: "33333333-3333-4333-8333-333333333333",
          name: "Akut VVS",
          description: "Akuta jobb",
          public_slug: "akut-vvs-sodertalje",
          primary_directory_service_slug: "vvs",
          conversion_mode: "quote",
        }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map([
      [WORKSPACE_ID, { planAccess: true, websiteBuilder: true, onlineBooking: true }],
    ]));

    const profile = await getResolvedPublicBusinessProfile("official-company-ab");

    expect(profile).not.toBeNull();
    expect(profile?.legal.legalName).toBe("Official Company AB");
    expect(profile?.presentation.displayName).toEqual({ value: "Owner Brand", source: "owner" });
    expect(profile?.services).toEqual([
      expect.objectContaining({
        id: "33333333-3333-4333-8333-333333333333",
        canonicalServiceSlug: "vvs",
        publicSlug: "akut-vvs-sodertalje",
        source: "owner",
      }),
    ]);
    expect(profile?.identity.workspaceSlug).toBe("owner-company");
    expect(profile?.capabilities).toMatchObject({
      directContact: true,
      richWebsite: true,
      onlineBooking: true,
    });
    expect(mocks.getWorkspaceDirectoryPublicAccessForWorkspaces).toHaveBeenCalledWith([WORKSPACE_ID]);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("keeps an unclaimed profile on official data and never asks for Workspace entitlements", async () => {
    mocks.getPublicDirectoryBusinessForRequest.mockResolvedValue(publicBusiness("published"));
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("from company_directory_profiles profile")) {
        return [{
          legal_name: "Official Company AB",
          claimed_workspace_id: null,
          owner_workspace_id: null,
        }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const profile = await getResolvedPublicBusinessProfile("official-company-ab");
    const publicProjection = await getPublicProfileBusinessProjection("official-company-ab");
    const seoProjection = await getSeoBusinessProjection("official-company-ab");

    expect(profile?.identity.ownershipState).toBe("unclaimed");
    expect(profile?.presentation.displayName.source).toBe("official");
    expect(profile?.services.map((service) => service.canonicalServiceSlug)).toEqual(["avloppsrensning"]);
    expect(profile?.contact.entitled).toBe(false);
    expect(profile?.capabilities.directContact).toBe(false);
    expect(publicProjection?.workspaceSlug).toBeNull();
    expect(seoProjection?.streetAddress).toBe("");
    expect(seoProjection?.contact).toEqual({ phone: "", email: "", website: "" });
    expect(mocks.getWorkspaceDirectoryPublicAccessForWorkspaces).not.toHaveBeenCalled();
  });

  it("returns null when the Directory public-safety resolver rejects the profile", async () => {
    mocks.getPublicDirectoryBusinessForRequest.mockResolvedValue(null);
    mocks.getSql.mockReturnValue(vi.fn());

    await expect(getResolvedPublicBusinessProfile("not-public")).resolves.toBeNull();
    expect(mocks.getPublicDirectoryProfileExtras).not.toHaveBeenCalled();
    expect(mocks.getWorkspaceDirectoryPublicAccessForWorkspaces).not.toHaveBeenCalled();
  });
});
