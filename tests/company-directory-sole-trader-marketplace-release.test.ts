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

function pendingManualReview() {
  return {
    ...claimedManualReview(),
    status: "pending",
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

  it("requires the exact privacy-safe blocked profile shape and claimed manual review", () => {
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
      postal_code: "15132",
    }, claimedManualReview())).toBe(false);
    expect(providerSoleTraderProfileCanReleaseMarketplace({
      ...profile,
      organization_number: "199001011234",
    }, claimedManualReview())).toBe(false);
    expect(providerSoleTraderProfileCanReleaseMarketplace({
      ...profile,
      organization_number: `sole-trader-${PROFILE_ID.toUpperCase()}`,
    }, claimedManualReview())).toBe(false);
    expect(providerSoleTraderProfileCanReleaseMarketplace({
      ...profile,
      official_source: "bolagsverket_vardefulla_datamangder:company",
    }, claimedManualReview())).toBe(false);
    expect(providerSoleTraderProfileCanReleaseMarketplace(profile, {
      ...claimedManualReview(),
      verification_method: "email_domain",
    })).toBe(false);
  });

  it("offers exact workspace service candidates before the public profile is released", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.startsWith("insert into workspace_services")) return [];
      if (query.includes("select profile.id::text") && query.includes("from company_directory_profiles profile")) {
        return [blockedSoleTraderProfile()];
      }
      if (query.includes("claim.status in ('pending', 'verified')")) return [];
      if (query.includes("claim.status = 'claimed'") && query.includes("claim.profile_id")) {
        return [{ status: "claimed", verification_method: "manual_review" }];
      }
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

  it("keeps pending-claim reporting separate from release eligibility", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.startsWith("insert into workspace_services")) return [];
      if (query.includes("select profile.id::text") && query.includes("from company_directory_profiles profile")) {
        return [blockedSoleTraderProfile()];
      }
      if (query.includes("claim.status in ('pending', 'verified')")) return [pendingManualReview()];
      if (query.includes("claim.status = 'claimed'") && query.includes("claim.profile_id")) {
        return [{ status: "claimed", verification_method: "manual_review" }];
      }
      if (query.includes("select service.slug, service.label")) return [];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const state = await getProviderActivationState();

    expect(state.pendingClaim).toEqual(expect.objectContaining({
      status: "pending",
      companyName: "Owner Service",
      organizationNumber: "",
      profileSlug: "",
    }));
    expect(state.directoryServices).toEqual([
      { slug: "fonsterputsning", label: "Fönsterputsning" },
    ]);
  });

  it("does not offer a blocked sole trader without a matching claimed release claim", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.startsWith("insert into workspace_services")) return [];
      if (query.includes("select profile.id::text") && query.includes("from company_directory_profiles profile")) {
        return [blockedSoleTraderProfile()];
      }
      if (query.includes("from company_directory_claims claim")) return [];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const state = await getProviderActivationState();

    expect(state.linkedProfile).toEqual(expect.objectContaining({ id: PROFILE_ID, slug: "" }));
    expect(state.directoryServices).toEqual([]);
  });

  it("delegates explicit release to the guarded PostgreSQL publication transaction", async () => {
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

    expect(sql).toHaveBeenCalledTimes(2);
    const publication = queryText(sql.mock.calls[1]![0] as TemplateStringsArray);
    expect(publication.startsWith("with service_guard as")).toBe(true);
  });
});