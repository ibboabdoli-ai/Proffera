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
  exactOwnerDirectoryServiceCandidate,
  getProviderActivationState,
} from "../src/lib/company-directory-provider-activation";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const SERVICE_ID = "33333333-3333-4333-8333-333333333333";

function queryText(strings: TemplateStringsArray) {
  return strings.join(" ").replace(/\s+/g, " ").trim();
}

function access() {
  return {
    ok: true as const,
    userId: "user-1",
    workspaceId: WORKSPACE_ID,
    workspaceSlug: "owner-company",
    workspaceName: "Owner Company",
    workspaceStatus: "active" as const,
    role: "owner" as const,
  };
}

describe("Company Directory smart claim service suggestions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getUserWorkspaceAccess.mockResolvedValue(access());
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.getDashboardWorkspaceServices.mockResolvedValue([
      {
        id: SERVICE_ID,
        name: "VVS / Rörmokare",
        isActive: true,
        publicStatus: "draft",
        primaryDirectoryServiceSlug: "vvs",
      },
    ]);
  });

  it("resolves only exact canonical labels and aliases as owner candidates", () => {
    expect(exactOwnerDirectoryServiceCandidate("Hemstädning")).toEqual({
      slug: "hemstadning",
      label: "Hemstädning",
    });
    expect(exactOwnerDirectoryServiceCandidate("Fönsterputs")).toEqual({
      slug: "fonsterputsning",
      label: "Fönsterputsning",
    });
    expect(exactOwnerDirectoryServiceCandidate("Premium städning deluxe")).toBeNull();
  });

  it("materializes exact claimed-profile services as drafts and remains idempotent on repeat reads", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.startsWith("insert into workspace_services")) return [];
      if (query.includes("select profile.id::text") && query.includes("from company_directory_profiles profile")) {
        return [{
          id: PROFILE_ID,
          public_slug: "owner-company-ab",
          display_name: "Owner Company AB",
          organization_number: "5560000000",
          organization_kind: "juridical_person",
          city: "Södertälje",
          publication_status: "claimed",
          is_active: true,
          privacy_blocked: false,
          auto_public_eligible: true,
          published_at: "2026-08-28T00:00:00.000Z",
        }];
      }
      if (query.includes("from company_directory_claims claim")) return [];
      if (query.includes("select service.slug, service.label")) {
        return [{ slug: "vvs", label: "VVS / Rörmokare" }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const first = await getProviderActivationState();
    const second = await getProviderActivationState();

    expect(first.directoryServices).toEqual([{ slug: "vvs", label: "VVS / Rörmokare" }]);
    expect(second.directoryServices).toEqual(first.directoryServices);
    expect(first.workspaceServices).toEqual([
      expect.objectContaining({
        id: SERVICE_ID,
        publicStatus: "draft",
        primaryDirectoryServiceSlug: "vvs",
      }),
    ]);

    const emittedQueries = sql.mock.calls.map(([strings]) => queryText(strings as TemplateStringsArray));
    const materializations = emittedQueries.filter((query) => query.startsWith("insert into workspace_services"));
    expect(materializations).toHaveLength(2);
    for (const query of materializations) {
      expect(query).toContain("profile.claimed_workspace_id =");
      expect(query).toContain("profile.publication_status = 'claimed'");
      expect(query).toContain("relation.is_active = true");
      expect(query).toContain("relation.public_visible = true");
      expect(query).toContain("service.slug = relation.service_slug");
      expect(query).toContain("service.is_active = true");
      expect(query).toContain("'quote'");
      expect(query).toContain("'draft'");
      expect(query).toContain("coalesce(nullif(trim(existing.primary_directory_service_slug), ''), existing.public_slug) = service.slug");
      expect(query).toContain("existing.public_slug = service.slug");
      expect(query).toContain("lower(trim(existing.name)) = lower(trim(service.label))");
      expect(query).toContain("on conflict do nothing");
    }
  });

  it("offers exact workspace-service matches even before a profile relation exists", async () => {
    mocks.getDashboardWorkspaceServices.mockResolvedValue([
      {
        id: SERVICE_ID,
        name: "Fönsterputs",
        isActive: true,
        publicStatus: "draft",
        primaryDirectoryServiceSlug: null,
      },
    ]);
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.startsWith("insert into workspace_services")) return [];
      if (query.includes("select profile.id::text") && query.includes("from company_directory_profiles profile")) {
        return [{
          id: PROFILE_ID,
          public_slug: "owner-company",
          display_name: "Owner Company",
          organization_number: "",
          organization_kind: "sole_trader",
          city: "Södertälje",
          publication_status: "claimed",
          is_active: true,
          privacy_blocked: false,
          auto_public_eligible: true,
          published_at: "2026-08-30T00:00:00.000Z",
        }];
      }
      if (query.includes("from company_directory_claims claim")) return [];
      if (query.includes("select service.slug, service.label")) return [];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const state = await getProviderActivationState();

    expect(state.directoryServices).toEqual([
      { slug: "fonsterputsning", label: "Fönsterputsning" },
    ]);
  });

  it("publishes existing profile relations through explicit owner activation and confirms owner service area", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.includes("select service.id::text") && query.includes("from workspace_services service")) {
        return [{
          id: SERVICE_ID,
          name: "VVS / Rörmokare",
          previous_directory_service_slug: null,
          profile_id: PROFILE_ID,
          has_existing_relation: true,
        }];
      }
      if (query.startsWith("with owner_relation as")) return [{ id: SERVICE_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await activateProviderMarketplaceService({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "vvs",
      conversionMode: "quote",
      radiusKm: 25,
    });

    expect(result).toEqual({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "vvs",
      conversionMode: "quote",
      radiusKm: 25,
    });

    const emittedQueries = sql.mock.calls.map(([strings]) => queryText(strings as TemplateStringsArray));
    const eligibility = emittedQueries.find((query) => query.includes("select service.id::text"));
    const publication = emittedQueries.find((query) => query.startsWith("with owner_relation as"));

    expect(eligibility).toContain("left join company_directory_profile_services relation");
    expect(eligibility).toContain("relation.is_active = true");
    expect(eligibility).toContain("relation.public_visible = true");
    expect(eligibility).toContain("duplicate.id <> service.id");
    expect(publication).toContain("public_status = 'published'");
    expect(publication).toContain("source_type, confidence, public_visible");
    expect(publication).toContain("'owner'");
    expect(publication).toContain("100");
    expect(publication).toContain("relation_guard");
  });

  it("creates an owner relation atomically for an exact candidate before publication", async () => {
    mocks.getDashboardWorkspaceServices.mockResolvedValue([
      { id: SERVICE_ID, name: "Fönsterputs", isActive: true, publicStatus: "draft" },
    ]);
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.includes("select service.id::text") && query.includes("from workspace_services service")) {
        return [{
          id: SERVICE_ID,
          name: "Fönsterputs",
          previous_directory_service_slug: null,
          profile_id: PROFILE_ID,
          has_existing_relation: false,
        }];
      }
      if (query.startsWith("with owner_relation as")) return [{ id: SERVICE_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(activateProviderMarketplaceService({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "fonsterputsning",
      conversionMode: "quote",
      radiusKm: 20,
    })).resolves.toEqual({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "fonsterputsning",
      conversionMode: "quote",
      radiusKm: 20,
    });

    const publication = sql.mock.calls
      .map(([strings]) => queryText(strings as TemplateStringsArray))
      .find((query) => query.startsWith("with owner_relation as"));
    expect(publication).toContain("insert into company_directory_profile_services");
    expect(publication).toContain("where company_directory_profile_services.source_type = 'owner'");
    expect(publication).toContain("and exists (select 1 from relation_guard)");
  });

  it("fails closed when a new owner mapping is not an exact taxonomy match", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.includes("select service.id::text") && query.includes("from workspace_services service")) {
        return [{
          id: SERVICE_ID,
          name: "Hemstädning",
          previous_directory_service_slug: null,
          profile_id: PROFILE_ID,
          has_existing_relation: false,
        }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(activateProviderMarketplaceService({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "fonsterputsning",
      conversionMode: "quote",
      radiusKm: 25,
    })).rejects.toThrow("service_not_eligible");

    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the activation eligibility query rejects the service", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);

    await expect(activateProviderMarketplaceService({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "vvs",
      conversionMode: "quote",
      radiusKm: 25,
    })).rejects.toThrow("service_not_eligible");

    expect(sql).toHaveBeenCalledTimes(1);
  });
});
