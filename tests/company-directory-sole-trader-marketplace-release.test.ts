import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
  getDashboardWorkspaceServices: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));
vi.mock("@/lib/workspace-services-db", () => ({
  getDashboardWorkspaceServices: mocks.getDashboardWorkspaceServices,
}));

import {
  activateProviderMarketplaceService,
  getProviderActivationState,
  providerSoleTraderProfileCanReleaseMarketplace,
} from "../src/lib/company-directory-provider-activation";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const SERVICE_ID = "33333333-3333-4333-8333-333333333333";
const SURROGATE_IDENTITY = `sole-trader-${PROFILE_ID}`;

function queryText(strings: TemplateStringsArray) {
  return strings.join(" ").replace(/\s+/g, " ").trim();
}

function blockedSoleTraderProfile() {
  return {
    id: PROFILE_ID,
    public_slug: "owner-service-22222222",
    display_name: "Owner Service",
    organization_number: SURROGATE_IDENTITY,
    organization_kind: "sole_trader",
    legal_form: "Enskild näringsverksamhet",
    organization_status: "Registrerad",
    address_line1: "",
    postal_code: "",
    city: "Södertälje",
    publication_status: "blocked",
    is_active: true,
    privacy_blocked: true,
    auto_public_eligible: false,
    official_source: "bolagsverket_vardefulla_datamangder:sole_trader_owner",
    published_at: null,
  };
}

function claimedManualReview() {
  return {
    status: "claimed",
    verification_method: "manual_review",
    display_name: "Owner Service",
    organization_number: SURROGATE_IDENTITY,
    organization_kind: "sole_trader",
    public_slug: "owner-service-22222222",
    publication_status: "blocked",
  };
}

describe("sole-trader Marketplace privacy release", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getUserWorkspaceAccess.mockResolvedValue({
      ok: true,
      userId: "user-1",
      workspaceId: WORKSPACE_ID,
      workspaceSlug: "owner-service",
      workspaceName: "Owner Service",
      workspaceStatus: "active",
      role: "owner",
    });
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.getDashboardWorkspaceServices.mockResolvedValue([
      {
        id: SERVICE_ID,
        name: "Fönsterputs",
        isActive: true,
        publicStatus: "draft",
        primaryDirectoryServiceSlug: null,
      },
    ]);
  });

  it("requires the privacy-safe blocked profile shape and a claimed manual review", () => {
    const profile = blockedSoleTraderProfile();
    expect(providerSoleTraderProfileCanReleaseMarketplace(profile, claimedManualReview())).toBe(true);
    expect(providerSoleTraderProfileCanReleaseMarketplace(profile, {
      ...claimedManualReview(),
      status: "pending",
    })).toBe(false);
    expect(providerSoleTraderProfileCanReleaseMarketplace({
      ...profile,
      address_line1: "Private address 1",
    }, claimedManualReview())).toBe(false);
    expect(providerSoleTraderProfileCanReleaseMarketplace({
      ...profile,
      organization_number: "199001011234",
    }, claimedManualReview())).toBe(false);
  });

  it("offers exact workspace service candidates before the public profile is released", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.startsWith("insert into workspace_services")) return [];
      if (query.includes("select profile.id::text") && query.includes("from company_directory_profiles profile")) {
        return [blockedSoleTraderProfile()];
      }
      if (query.includes("from company_directory_claims claim")) return [claimedManualReview()];
      if (query.includes("select service.slug, service.label")) return [];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const state = await getProviderActivationState();

    expect(state.linkedProfile).toEqual(expect.objectContaining({
      id: PROFILE_ID,
      slug: "",
      companyName: "Owner Service",
      organizationNumber: "",
    }));
    expect(state.pendingClaim).toBeNull();
    expect(state.directoryServices).toEqual([
      { slug: "fonsterputsning", label: "Fönsterputsning" },
    ]);
  });

  it("releases the blocked sole-trader profile only inside explicit service publication guards", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.includes("select service.id::text") && query.includes("from workspace_services service")) {
        return [{
          id: SERVICE_ID,
          name: "Fönsterputs",
          previous_directory_service_slug: null,
          profile_id: PROFILE_ID,
          has_existing_relation: false,
          requires_privacy_release: true,
        }];
      }
      if (query.startsWith("with service_guard as")) return [{ id: SERVICE_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(activateProviderMarketplaceService({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "fonsterputsning",
      conversionMode: "quote",
      radiusKm: 25,
    })).resolves.toEqual({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "fonsterputsning",
      conversionMode: "quote",
      radiusKm: 25,
    });

    const queries = sql.mock.calls.map(([strings]) => queryText(strings as TemplateStringsArray));
    const eligibility = queries.find((query) => query.includes("select service.id::text"));
    const publication = queries.find((query) => query.startsWith("with service_guard as"));

    expect(eligibility).toContain("profile.organization_kind = 'sole_trader'");
    expect(eligibility).toContain("owner_claim.status = 'claimed'");
    expect(eligibility).toContain("owner_claim.verification_method = 'manual_review'");
    expect(eligibility).toContain("coalesce(trim(profile.address_line1), '') = ''");
    expect(eligibility).toContain("coalesce(trim(profile.postal_code), '') = ''");

    expect(publication).toContain("profile_guard as");
    expect(publication).toContain("released_profile as");
    expect(publication).toContain("publication_status = 'claimed'");
    expect(publication).toContain("privacy_blocked = false");
    expect(publication).toContain("auto_public_eligible = true");
    expect(publication).toContain("published_at = coalesce(profile.published_at, now())");
    expect(publication).toContain("sole_trader_owner_verified_business_safe");
    expect(publication).toContain("exists (select 1 from publication_profile)");
  });
});