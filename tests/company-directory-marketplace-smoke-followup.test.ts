import { readFileSync } from "node:fs";
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

import { directoryProfileCopy } from "../src/components/company-directory/public-directory-profile-copy";
import {
  activateProviderMarketplaceService,
  providerWorkspaceServiceMatchesDirectoryService,
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

describe("Marketplace first real publication smoke follow-up", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getUserWorkspaceAccess.mockResolvedValue(access());
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
  });

  it("keeps the dashboard Testa i sök link service-only", () => {
    const source = readFileSync("src/app/dashboard/marknadsplats/page.tsx", "utf8");
    expect(source).not.toContain("linkedProfileCity");
    expect(source).not.toContain("&location=${encodeURIComponent(linkedProfileCity)}");
    expect(source).toContain("/foretag/listad?service=${encodeURIComponent(service.publicSlug)}");
    expect(source).toContain("/en/companies?service=${encodeURIComponent(service.publicSlug)}");
  });

  it("uses ownership-aware source disclosures", () => {
    expect(directoryProfileCopy.sv.sourceOwner).toContain("inte");
    expect(directoryProfileCopy.sv.sourceOwnerClaimed).toContain("har verifierat");
    expect(directoryProfileCopy.en.sourceOwner).toContain("does not mean");
    expect(directoryProfileCopy.en.sourceOwnerClaimed).toContain("has verified and claimed");

    const profileSource = readFileSync("src/components/company-directory/public-directory-profile.tsx", "utf8");
    expect(profileSource).toContain('profile.identity.ownershipState === "claimed" ? t.sourceOwnerClaimed : t.sourceOwner');
  });

  it("treats an existing canonical Workspace Service identity as authoritative", () => {
    expect(providerWorkspaceServiceMatchesDirectoryService({
      name: "Hemstädning",
      primaryDirectoryServiceSlug: "hemstadning",
    }, "hemstadning")).toBe(true);

    expect(providerWorkspaceServiceMatchesDirectoryService({
      name: "Hemstädning",
      primaryDirectoryServiceSlug: "hemstadning",
    }, "flyttstadning")).toBe(false);
  });

  it("falls back only to exact deterministic taxonomy resolution when no canonical identity exists", () => {
    expect(providerWorkspaceServiceMatchesDirectoryService({
      name: "Fönsterputs",
      primaryDirectoryServiceSlug: null,
    }, "fonsterputsning")).toBe(true);

    expect(providerWorkspaceServiceMatchesDirectoryService({
      name: "Premium städning deluxe",
      primaryDirectoryServiceSlug: null,
    }, "hemstadning")).toBe(false);
  });

  it("rejects a mismatched service even when the profile already has that Directory relation", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.includes("select service.id::text") && query.includes("from workspace_services service")) {
        return [{
          id: SERVICE_ID,
          name: "Hemstädning",
          previous_directory_service_slug: "hemstadning",
          profile_id: PROFILE_ID,
          has_existing_relation: true,
          requires_privacy_release: false,
        }];
      }
      if (query.startsWith("with service_guard as")) return [{ id: SERVICE_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(activateProviderMarketplaceService({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "flyttstadning",
      conversionMode: "book",
      radiusKm: 25,
    })).rejects.toThrow("service_not_eligible");

    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("preserves the valid exact canonical activation path and rechecks the locked service identity", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.includes("select service.id::text") && query.includes("from workspace_services service")) {
        return [{
          id: SERVICE_ID,
          name: "Hemstädning",
          previous_directory_service_slug: "hemstadning",
          profile_id: PROFILE_ID,
          has_existing_relation: true,
          requires_privacy_release: false,
        }];
      }
      if (query.startsWith("with service_guard as")) return [{ id: SERVICE_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(activateProviderMarketplaceService({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "hemstadning",
      conversionMode: "book",
      radiusKm: 25,
    })).resolves.toEqual({
      serviceId: SERVICE_ID,
      directoryServiceSlug: "hemstadning",
      conversionMode: "book",
      radiusKm: 25,
    });

    const publication = sql.mock.calls
      .map(([strings]) => queryText(strings as TemplateStringsArray))
      .find((query) => query.startsWith("with service_guard as"));
    expect(publication).toContain("service.name =");
    expect(publication).toContain("coalesce(nullif(trim(service.primary_directory_service_slug), ''), '') =");
  });
});
