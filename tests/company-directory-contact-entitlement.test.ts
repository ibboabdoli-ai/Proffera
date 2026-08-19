import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  hasWorkspacePlanAccessForWorkspace: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-engine", () => ({
  getPublicDirectoryBusiness: mocks.getPublicDirectoryBusiness,
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspacePlanAccessForWorkspace: mocks.hasWorkspacePlanAccessForWorkspace,
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

import { gateDirectoryDirectContact } from "../src/lib/company-directory-contact-entitlement";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import { searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";

const freeWorkspaceId = "11111111-1111-4111-8111-111111111111";
const paidWorkspaceId = "22222222-2222-4222-8222-222222222222";

function publishedBusiness(slug: string, addressLine1: string) {
  return {
    id: `${slug}-id`,
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
    display_name: "Claimed AB",
    legal_form: "AB",
    organization_status: "Aktiv",
    category_slug: "vvs",
    primary_sni_label: "VVS",
    activity_description: "",
    address_line1: addressLine1,
    postal_code: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    region: "Stockholm",
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
    mocks.hasWorkspacePlanAccessForWorkspace.mockReset();
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockReset();

    mocks.getSql.mockReturnValue(null);
    mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    mocks.hasWorkspacePlanAccessForWorkspace.mockResolvedValue(false);
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map());
  });

  it("fails closed for every direct contact field without plan entitlement", () => {
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

  it("preserves normalized direct contact fields when plan entitlement exists", () => {
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
    expect(mocks.hasWorkspacePlanAccessForWorkspace).not.toHaveBeenCalled();
  });

  it("redacts Claimed Free but preserves normalized address for an entitled claimed profile", async () => {
    const sql = vi.fn(async () => [claimedFallbackRow(freeWorkspaceId, "claimed-free-profile", "Freegatan 2")]);
    mocks.getSql.mockReturnValue(sql);
    mocks.hasWorkspacePlanAccessForWorkspace.mockResolvedValue(false);

    const freeResult = await getPublicDirectoryBusinessForRequest("claimed-free-profile");
    expect(freeResult?.publicationStatus).toBe("claimed");
    expect(freeResult?.addressLine1).toBe("");

    sql.mockImplementation(async () => [claimedFallbackRow(paidWorkspaceId, "claimed-paid-profile", "  Paidgatan 3  ")]);
    mocks.hasWorkspacePlanAccessForWorkspace.mockResolvedValue(true);

    const paidResult = await getPublicDirectoryBusinessForRequest("claimed-paid-profile");
    expect(paidResult?.publicationStatus).toBe("claimed");
    expect(paidResult?.addressLine1).toBe("Paidgatan 3");
  });

  it("redacts unclaimed/free page-two results, preserves entitled contact, and uses the page offset", async () => {
    const rows = [
      searchRow({
        id: "published-id",
        slug: "published-search",
        publicationStatus: "published",
        addressLine1: "Publicgatan 1",
      }),
      searchRow({
        id: "free-id",
        slug: "free-search",
        publicationStatus: "claimed",
        addressLine1: "Freegatan 2",
        workspaceId: freeWorkspaceId,
      }),
      searchRow({
        id: "paid-id",
        slug: "paid-search",
        publicationStatus: "claimed",
        addressLine1: "  Paidgatan 3  ",
        workspaceId: paidWorkspaceId,
      }),
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