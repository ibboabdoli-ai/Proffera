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
      primary_sni_code: "43.221",
      website_url: "https://example.se",
      phone: "+46 8 123 45 67",
      email: "kontakt@example.se",
      direct_address_line1: "SCB-gatan 2",
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
    const sql = vi.fn(async () => [claimedFallbackRow(freeWorkspaceId, "claimed-free-profile", "Freegatan 2")]);
    mocks.getSql.mockReturnValue(sql);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(false);

    const freeResult = await getPublicDirectoryBusinessForRequest("claimed-free-profile");
    expect(freeResult?.publicationStatus).toBe("claimed");
    expect(freeResult?.addressLine1).toBe("");
    expect(freeResult?.contact.available.phone).toBe(true);
    expect(freeResult?.contact.phone).toBe("");

    sql.mockImplementation(async () => [claimedFallbackRow(paidWorkspaceId, "claimed-paid-profile", "  Paidgatan 3  ")]);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(true);

    const paidResult = await getPublicDirectoryBusinessForRequest("claimed-paid-profile");
    expect(paidResult?.publicationStatus).toBe("claimed");
    expect(paidResult?.addressLine1).toBe("Paidgatan 3");
    expect(paidResult?.contact.phone).toBe("+46 8 123 45 67");
    expect(paidResult?.contact.email).toBe("kontakt@claimed.example");
    expect(paidResult?.contact.website).toBe("https://claimed.example");
  });

  it("redacts unclaimed and free search results while preserving an entitled claimed result", async () => {
    const rows = [
      searchRow({ id: "published-id", slug: "published-search", publicationStatus: "published", addressLine1: "Publicgatan 1" }),
      searchRow({ id: "free-id", slug: "free-search", publicationStatus: "claimed", addressLine1: "Freegatan 2", workspaceId: freeWorkspaceId }),
      searchRow({ id: "paid-id", slug: "paid-search", publicationStatus: "claimed", addressLine1: "  Paidgatan 3  ", workspaceId: paidWorkspaceId }),
    ];
    mocks.getSql.mockReturnValue(vi.fn(async () => rows));
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map([
      [freeWorkspaceId, { planAccess: false, websiteBuilder: false, onlineBooking: false }],
      [paidWorkspaceId, { planAccess: true, websiteBuilder: false, onlineBooking: false }],
    ]));

    const result = await searchPublishedCompanyDirectory({ limit: 10 });

    expect(result.results.map((item) => [item.slug, item.addressLine1])).toEqual([
      ["published-search", ""],
      ["free-search", ""],
      ["paid-search", "Paidgatan 3"],
    ]);
  });
});
