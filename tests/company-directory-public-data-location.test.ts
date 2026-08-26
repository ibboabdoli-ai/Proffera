import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  hasActivePaidDirectoryContactAccess: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-engine", () => ({
  getPublicDirectoryBusiness: mocks.getPublicDirectoryBusiness,
}));
vi.mock("@/lib/company-directory-paid-contact-entitlement", () => ({
  hasActivePaidDirectoryContactAccess: mocks.hasActivePaidDirectoryContactAccess,
}));

import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

function publicBusiness() {
  return {
    id: PROFILE_ID,
    slug: "physical-location-ab",
    companyName: "Physical Location AB",
    legalForm: "AB",
    organizationStatus: "Aktivt",
    categorySlug: "vvs",
    primarySniLabel: "VVS-arbeten",
    activityDescription: "VVS",
    addressLine1: "BOX 10",
    postalCode: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    region: "Stockholm",
    qualityScore: 95,
    officialSource: "bolagsverket_vardefulla_datamangder",
    sourceUpdatedAt: "2026-08-25T00:00:00.000Z",
    lastCheckedAt: "2026-08-25T00:00:00.000Z",
    media: null,
  };
}

function scbWorkplace() {
  return {
    municipality: "Södertälje",
    visitingAddress: {
      addressLine: "SCB-GATAN 9",
      postalCode: "151 00",
      city: "SÖDERTÄLJE",
    },
  };
}

function sqlForPublished(
  workplaces: unknown,
  claimedWorkspaceId: string | null = null,
  ownerLocation: Record<string, unknown> | null = null,
) {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("from company_directory_profiles") && !query.includes("from company_directory_profiles profile")) {
      return [{
        organization_number: "5560000000",
        primary_sni_code: "43.221",
        website_url: "",
        claimed_workspace_id: claimedWorkspaceId,
      }];
    }
    if (query.includes("from company_directory_scb_enrichment")) {
      return [{ phone: "", email: "", workplaces }];
    }
    if (query.includes("from company_directory_profile_locations")) {
      return ownerLocation ? [ownerLocation] : [];
    }
    return [];
  });
}

function claimedRow() {
  return {
    id: PROFILE_ID,
    public_slug: "physical-location-ab",
    organization_number: "5560000000",
    display_name: "Physical Location AB",
    legal_form: "AB",
    organization_status: "Aktivt",
    category_slug: "vvs",
    primary_sni_code: "43.221",
    primary_sni_label: "VVS-arbeten",
    activity_description: "VVS",
    address_line1: "POSTGATAN 1",
    postal_code: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    region: "Stockholm",
    website_url: "",
    quality_score: 95,
    official_source: "bolagsverket_vardefulla_datamangder",
    source_updated_at: "2026-08-25T00:00:00.000Z",
    last_synced_at: "2026-08-25T00:00:00.000Z",
    claimed_workspace_id: WORKSPACE_ID,
    media_url: null,
  };
}

function claimedSql(ownerLocation: Record<string, unknown> | null = null) {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("from company_directory_profiles profile")) return [claimedRow()];
    if (query.includes("from company_directory_scb_enrichment")) {
      return [{ phone: "", email: "", workplaces: [scbWorkplace()] }];
    }
    if (query.includes("from company_directory_profile_locations")) {
      return ownerLocation ? [ownerLocation] : [];
    }
    return [];
  });
}

describe("public Directory physical-location read contract", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.getPublicDirectoryBusiness.mockReset();
    mocks.hasActivePaidDirectoryContactAccess.mockReset();
  });

  it("uses the one complete SCB workplace for an unclaimed published profile", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness());
    mocks.getSql.mockReturnValue(sqlForPublished([scbWorkplace()]));

    const result = await getPublicDirectoryBusinessForRequest("physical-location-ab");

    expect(result).toMatchObject({
      publicationStatus: "published",
      postalCode: "151 00",
      city: "SÖDERTÄLJE",
      municipality: "Södertälje",
    });
    expect(result?.addressLine1).toBe("");
  });

  it("fails closed instead of exposing the profile postal address as physical for ambiguous workplaces", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness());
    mocks.getSql.mockReturnValue(sqlForPublished([
      scbWorkplace(),
      {
        municipality: "Stockholm",
        visitingAddress: {
          addressLine: "ANNAN GATA 3",
          postalCode: "111 22",
          city: "STOCKHOLM",
        },
      },
    ]));

    const result = await getPublicDirectoryBusinessForRequest("physical-location-ab");

    expect(result).toMatchObject({
      publicationStatus: "published",
      addressLine1: "",
      postalCode: "",
      city: "",
      municipality: "",
    });
  });

  it("does not treat a claim as proof that stored profile postal fields are a physical location", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(true);
    mocks.getSql.mockReturnValue(claimedSql());

    const result = await getPublicDirectoryBusinessForRequest("physical-location-ab");

    expect(result).toMatchObject({
      publicationStatus: "claimed",
      addressLine1: "SCB-GATAN 9",
      postalCode: "151 00",
      city: "SÖDERTÄLJE",
      municipality: "Södertälje",
    });
  });

  it("uses the claimed Workspace primary public owner location over SCB", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(true);
    mocks.getSql.mockReturnValue(claimedSql({
      visibility: "public",
      is_visitable: true,
      confirmed_at: "2026-08-26T00:00:00.000Z",
      address_line1: "OWNERGATAN 1",
      postal_code: "111 11",
      city: "Stockholm",
      municipality: "Stockholm",
    }));

    const result = await getPublicDirectoryBusinessForRequest("physical-location-ab");

    expect(result).toMatchObject({
      publicationStatus: "claimed",
      addressLine1: "OWNERGATAN 1",
      postalCode: "111 11",
      city: "Stockholm",
      municipality: "Stockholm",
    });
  });

  it("respects a claimed Workspace private primary owner location instead of leaking SCB exact location", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(true);
    mocks.getSql.mockReturnValue(claimedSql({
      visibility: "private",
      is_visitable: false,
      confirmed_at: null,
      address_line1: "OWNERGATAN 1",
      postal_code: "111 11",
      city: "Stockholm",
      municipality: "Stockholm",
    }));

    const result = await getPublicDirectoryBusinessForRequest("physical-location-ab");

    expect(result).toMatchObject({
      publicationStatus: "claimed",
      addressLine1: "",
      postalCode: "",
      city: "",
      municipality: "",
    });
  });
});