import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  hasActivePaidDirectoryContactAccess: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-engine", () => ({
  getPublicDirectoryBusiness: mocks.getPublicDirectoryBusiness,
}));
vi.mock("@/lib/company-directory-paid-contact-entitlement", () => ({
  hasActivePaidDirectoryContactAccess: mocks.hasActivePaidDirectoryContactAccess,
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

import {
  discloseDirectoryDirectContact,
  gateDirectoryDirectContact,
} from "../src/lib/company-directory-contact-entitlement";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import { searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";

const freeWorkspaceId = "11111111-1111-4111-8111-111111111111";
const paidWorkspaceId = "22222222-2222-4222-8222-222222222222";

function publishedBusiness(slug: string, addressLine1: string) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    slug,
    companyName: "Public AB",
    legalForm: "AB",
    organizationStatus: "Aktiv",
    categorySlug: "vvs",
    primarySniLabel: "VVS",
    activityDescription: "",
    addressLine1,
    postalCode: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    region: "Stockholm",
    qualityScore: 99,
    officialSource: "bolagsverket",
    sourceUpdatedAt: "",
    lastCheckedAt: "",
    media: null,
  };
}

function claimedFallbackRow(workspaceId: string, slug: string, addressLine1: string) {
  return {
    id: `${slug}-id`,
    public_slug: slug,
    organization_number: "5560000000",
    organization_kind: "juridical_person",
    display_name: "Claimed AB",
    legal_form: "AB",
    organization_status: "Aktiv",
    category_slug: "vvs",
    primary_sni_code: "43.221",
    primary_sni_label: "VVS",
    activity_description: "",
    address_line1: addressLine1,
    direct_address_line1: addressLine1,
    postal_code: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    region: "Stockholm",
    website_url: "https://claimed.example",
    phone: "+46 8 123 45 67",
    email: "kontakt@claimed.example",
    quality_score: 99,
    official_source: "bolagsverket",
    source_updated_at: null,
    last_synced_at: null,
    claimed_workspace_id: workspaceId,
    media_url: null,
    media_kind: null,
    attribution: null,
    is_actual_business_media: false,
  };
}

function searchRow(input: {
  id: string;
  slug: string;
  publicationStatus: "published" | "claimed";
  addressLine1: string;
  workspaceId?: string;
}) {
  return {
    id: input.id,
    public_slug: input.slug,
    display_name: `${input.slug} AB`,
    category_slug: "vvs",
    publication_status: input.publicationStatus,
    service_slug: "vvs",
    service_label: "VVS / Rörmokare",
    activity_description: "",
    address_line1: input.addressLine1,
    postal_code: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    quality_score: 95,
    latitude: null,
    longitude: null,
    service_area_radius_km: null,
    claimed_workspace_id: input.workspaceId ?? null,
    claimed_workspace_slug: input.workspaceId ? `${input.slug}-workspace` : null,
    claimed_booking_slug: null,
    claimed_service_id: null,
    claimed_service_slug: null,
    claimed_service_conversion_mode: null,
    distance_km: null,
  };
}

describe("company directory direct-contact entitlement", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.getPublicDirectoryBusiness.mockReset();
    mocks.hasActivePaidDirectoryContactAccess.mockReset();
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockReset();

    mocks.getSql.mockReturnValue(null);
    mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(false);
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map());
  });

  it("fails closed for every direct contact field without paid plan entitlement", () => {
    expect(gateDirectoryDirectContact({
      addressLine1: "Examplegatan 1",
      phone: "+46 8 123 45 67",
      email: "kontakt@example.se",
      website: "https://example.se",
    }, false)).toEqual({
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
    });
  });

  it("preserves availability metadata without leaking locked values", () => {
    expect(discloseDirectoryDirectContact({
      addressLine1: "Examplegatan 1",
      phone: "+46 8 123 45 67",
      email: "kontakt@example.se",
      website: "",
    }, false)).toEqual({
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
      entitled: false,
      available: {
        addressLine1: true,
        phone: true,
        email: true,
        website: false,
      },
    });
  });

  it("preserves normalized direct contact fields when paid entitlement exists", () => {
    expect(gateDirectoryDirectContact({
      addressLine1: "  Examplegatan 1  ",
      phone: "  +46 8 123 45 67  ",
      email: "  kontakt@example.se  ",
      website: "  https://example.se  ",
    }, true)).toEqual({
      addressLine1: "Examplegatan 1",
      phone: "+46 8 123 45 67",
      email: "kontakt@example.se",
      website: "https://example.se",
    });
  });

  it("redacts the street address from an unclaimed published public profile", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue(
      publishedBusiness("unclaimed-public-profile", "Unclaimedgatan 1"),
    );

    const result = await getPublicDirectoryBusinessForRequest("unclaimed-public-profile");

    expect(result?.publicationStatus).toBe("published");
    expect(result?.addressLine1).toBe("");
    expect(result?.contact.entitled).toBe(false);
    expect(mocks.hasActivePaidDirectoryContactAccess).not.toHaveBeenCalled();
  });

  it("shows that SCB contact fields exist while keeping their values redacted", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue(
      publishedBusiness("scb-public-profile", "Profilegatan 1"),
    );
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      organization_number: "5561234567",
      organization_kind: "juridical_person",
      primary_sni_code: "43.221",
      website_url: "https://example.se",
      phone: "+46 8 123 45 67",
      email: "kontakt@example.se",
      workplaces: [{
        cfarNumber: "12345678",
        municipality: "Stockholm",
        visitingAddress: {
          addressLine: "SCB-gatan 2",
          postalCode: "111 11",
          city: "Stockholm",
        },
      }],
    }]));

    const result = await getPublicDirectoryBusinessForRequest("scb-public-profile");

    expect(result?.organizationNumber).toBe("5561234567");
    expect(result?.primarySniCode).toBe("43.221");
    expect(result?.contact).toEqual({
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
      entitled: false,
      available: {
        addressLine1: true,
        phone: true,
        email: true,
        website: true,
      },
    });
  });

  it("keeps Free or Trial claimed profiles locked and reveals paid active contact", async () => {
    let claimedRow = claimedFallbackRow(freeWorkspaceId, "claimed-free-profile", "Freegatan 2");
    let ownerAddressLine1 = "Freegatan 2";
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("from company_directory_profiles profile")) return [claimedRow];
      if (query.includes("from company_directory_scb_enrichment")) {
        return [{
          phone: "+46 8 123 45 67",
          email: "kontakt@claimed.example",
          workplaces: [],
        }];
      }
      if (query.includes("from company_directory_profile_locations")) {
        return [{
          visibility: "public",
          is_visitable: true,
          confirmed_at: "2026-08-26T00:00:00.000Z",
          address_line1: ownerAddressLine1,
          postal_code: "111 11",
          city: "Stockholm",
          municipality: "Stockholm",
        }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(false);

    const freeResult = await getPublicDirectoryBusinessForRequest("claimed-free-profile");
    expect(freeResult?.publicationStatus).toBe("claimed");
    expect(freeResult?.addressLine1).toBe("");
    expect(freeResult?.contact.available.phone).toBe(true);
    expect(freeResult?.contact.phone).toBe("");

    claimedRow = claimedFallbackRow(paidWorkspaceId, "claimed-paid-profile", "Stored postal address");
    ownerAddressLine1 = "  Paidgatan 3  ";
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(true);

    const paidResult = await getPublicDirectoryBusinessForRequest("claimed-paid-profile");
    expect(paidResult?.publicationStatus).toBe("claimed");
    expect(paidResult?.addressLine1).toBe("Paidgatan 3");
    expect(paidResult?.contact.phone).toBe("+46 8 123 45 67");
    expect(paidResult?.contact.email).toBe("kontakt@claimed.example");
    expect(paidResult?.contact.website).toBe("https://claimed.example");
  });

  it("redacts unclaimed/free page-two results, preserves entitled contact, and uses the page offset", async () => {
    const rows = [
      searchRow({ id: "published-id", slug: "published-search", publicationStatus: "published", addressLine1: "Publicgatan 1" }),
      searchRow({ id: "free-id", slug: "free-search", publicationStatus: "claimed", addressLine1: "Freegatan 2", workspaceId: freeWorkspaceId }),
      searchRow({ id: "paid-id", slug: "paid-search", publicationStatus: "claimed", addressLine1: "  Paidgatan 3  ", workspaceId: paidWorkspaceId }),
    ];
    const sql = vi.fn()
      .mockResolvedValueOnce([{ total_count: 65 }])
      .mockResolvedValueOnce(rows);
    mocks.getSql.mockReturnValue(sql);
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map([
      [freeWorkspaceId, { planAccess: false, websiteBuilder: false, onlineBooking: false }],
      [paidWorkspaceId, { planAccess: true, websiteBuilder: false, onlineBooking: false }],
    ]));

    const result = await searchPublishedCompanyDirectory({ limit: 30, page: 2 });

    expect(sql).toHaveBeenCalledTimes(2);
    const resultQueryCall = sql.mock.calls[1] ?? [];
    expect(resultQueryCall.at(-2)).toBe(30);
    expect(resultQueryCall.at(-1)).toBe(30);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(30);
    expect(result.totalCount).toBe(65);
    expect(result.totalPages).toBe(3);
    expect(mocks.getWorkspaceDirectoryPublicAccessForWorkspaces).toHaveBeenCalledTimes(1);
    expect(mocks.getWorkspaceDirectoryPublicAccessForWorkspaces).toHaveBeenCalledWith([
      freeWorkspaceId,
      paidWorkspaceId,
    ]);
    expect(result.results.map((item) => [item.slug, item.addressLine1])).toEqual([
      ["published-search", ""],
      ["free-search", ""],
      ["paid-search", "Paidgatan 3"],
    ]);
  });

  it.each([
    { page: 0, expectedPage: 1, expectedOffset: 0 },
    { page: "not-a-page", expectedPage: 1, expectedOffset: 0 },
    { page: 99, expectedPage: 3, expectedOffset: 60 },
  ])("normalizes page $page to $expectedPage and uses offset $expectedOffset", async ({ page, expectedPage, expectedOffset }) => {
    const rows = [searchRow({
      id: "published-page-id",
      slug: "published-page-search",
      publicationStatus: "published",
      addressLine1: "Publicgatan 1",
    })];
    const sql = vi.fn()
      .mockResolvedValueOnce([{ total_count: 65 }])
      .mockResolvedValueOnce(rows);
    mocks.getSql.mockReturnValue(sql);

    const result = await searchPublishedCompanyDirectory({ limit: 30, page });

    expect(sql).toHaveBeenCalledTimes(2);
    const resultQueryCall = sql.mock.calls[1] ?? [];
    expect(resultQueryCall.at(-2)).toBe(30);
    expect(resultQueryCall.at(-1)).toBe(expectedOffset);
    expect(result.page).toBe(expectedPage);
    expect(result.pageSize).toBe(30);
    expect(result.totalCount).toBe(65);
    expect(result.totalPages).toBe(3);
  });
});
