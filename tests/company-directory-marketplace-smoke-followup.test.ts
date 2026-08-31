import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
  getDashboardWorkspaceServices: vi.fn(),
  getPublicBusinessProfileViewForRequest: vi.fn(),
  getClaimedDirectoryWorkspaceSlug: vi.fn(),
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
vi.mock("@/lib/business-profile-public", () => ({
  getPublicBusinessProfileViewForRequest: mocks.getPublicBusinessProfileViewForRequest,
}));
vi.mock("@/lib/company-directory-routing", () => ({
  getClaimedDirectoryWorkspaceSlug: mocks.getClaimedDirectoryWorkspaceSlug,
}));

import MarketplaceActivationPage from "../src/app/dashboard/marknadsplats/page";
import { PublicDirectoryProfile } from "../src/components/company-directory/public-directory-profile";
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

function walkReactTree(node: ReactNode, visit: (value: ReactNode) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walkReactTree(child, visit);
    return;
  }
  if (!isValidElement(node)) {
    visit(node);
    return;
  }
  visit(node);
  walkReactTree((node.props as { children?: ReactNode }).children, visit);
}

function renderedHrefs(node: ReactNode) {
  const hrefs: string[] = [];
  walkReactTree(node, (value) => {
    if (!isValidElement(value)) return;
    const href = (value.props as { href?: unknown }).href;
    if (typeof href === "string") hrefs.push(href);
  });
  return hrefs;
}

function renderedText(node: ReactNode) {
  const parts: string[] = [];
  walkReactTree(node, (value) => {
    if (typeof value === "string" || typeof value === "number") parts.push(String(value));
  });
  return parts.join(" ");
}

function linkedProfileSql() {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = queryText(strings);
    if (query.startsWith("insert into workspace_services")) return [];
    if (query.includes("select profile.id::text") && query.includes("from company_directory_profiles profile")) {
      return [{
        id: PROFILE_ID,
        public_slug: "owner-company-ab",
        display_name: "Owner Company AB",
        organization_number: "5560000000",
        organization_kind: "juridical_person",
        legal_form: "Aktiebolag",
        organization_status: "Registrerad",
        address_line1: "",
        postal_code: "",
        city: "Södertälje",
        publication_status: "claimed",
        is_active: true,
        privacy_blocked: false,
        auto_public_eligible: true,
        official_source: "bolagsverket_vardefulla_datamangder:company",
        published_at: "2026-08-31T00:00:00.000Z",
      }];
    }
    if (query.includes("from company_directory_claims claim")) return [];
    if (query.includes("select service.slug, service.label")) {
      return [{ slug: "hemstadning", label: "Hemstädning" }];
    }
    return [];
  });
}

function profileView(ownershipState: "claimed" | "unclaimed") {
  return {
    business: {
      id: PROFILE_ID,
      slug: "owner-company-ab",
      companyName: "Owner Company AB",
      categorySlug: "stadning",
      primarySniCode: "81210",
      primarySniLabel: "Lokalvård",
      activityDescription: "",
      addressLine1: "",
      postalCode: "",
      city: "Södertälje",
      municipality: "Södertälje",
      legalForm: "Aktiebolag",
      organizationStatus: "Registrerad",
      organizationNumber: "5560000000",
      lastCheckedAt: "2026-08-31T00:00:00.000Z",
      media: null,
      contact: {
        entitled: false,
        addressLine1: "",
        phone: "",
        email: "",
        website: "",
        available: {
          addressLine1: false,
          phone: false,
          email: false,
          website: false,
        },
      },
    },
    extras: {
      services: [],
      serviceAreas: [],
      reputation: null,
    },
    profile: {
      identity: {
        ownershipState,
        workspaceSlug: "",
      },
      capabilities: {
        richWebsite: false,
      },
    },
  };
}

describe("Marketplace first real publication smoke follow-up", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getUserWorkspaceAccess.mockResolvedValue(access());
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.getClaimedDirectoryWorkspaceSlug.mockResolvedValue(null);
  });

  it("renders Swedish and English Testa i sök links with service only", async () => {
    mocks.getDashboardWorkspaceServices.mockResolvedValue([{
      id: SERVICE_ID,
      name: "Hemstädning",
      isActive: true,
      publicStatus: "published",
      publicSlug: "hemstadning",
      primaryDirectoryServiceSlug: "hemstadning",
      conversionMode: "book",
      serviceAreaConfirmed: true,
      serviceAreaRadiusKm: 25,
    }]);
    mocks.getSql.mockReturnValue(linkedProfileSql());

    const svPage = await MarketplaceActivationPage({ searchParams: Promise.resolve({}) });
    const svSearchHref = renderedHrefs(svPage).find((href) => href.includes("service=hemstadning"));
    expect(svSearchHref).toBe("/foretag/listad?service=hemstadning");
    expect(svSearchHref).not.toContain("location=");

    const enPage = await MarketplaceActivationPage({ searchParams: Promise.resolve({ lang: "en" }) });
    const enSearchHref = renderedHrefs(enPage).find((href) => href.includes("service=hemstadning"));
    expect(enSearchHref).toBe("/en/companies?service=hemstadning");
    expect(enSearchHref).not.toContain("location=");
  });

  it("renders ownership-aware source disclosures for claimed and unclaimed profiles", async () => {
    mocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(profileView("claimed"));
    const claimedSv = renderedText(await PublicDirectoryProfile({ slug: "owner-company-ab", locale: "sv" }));
    const claimedEn = renderedText(await PublicDirectoryProfile({ slug: "owner-company-ab", locale: "en" }));
    expect(claimedSv).toContain(directoryProfileCopy.sv.sourceOwnerClaimed);
    expect(claimedSv).not.toContain(directoryProfileCopy.sv.sourceOwner);
    expect(claimedEn).toContain(directoryProfileCopy.en.sourceOwnerClaimed);
    expect(claimedEn).not.toContain(directoryProfileCopy.en.sourceOwner);

    mocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(profileView("unclaimed"));
    const unclaimedSv = renderedText(await PublicDirectoryProfile({ slug: "owner-company-ab", locale: "sv" }));
    const unclaimedEn = renderedText(await PublicDirectoryProfile({ slug: "owner-company-ab", locale: "en" }));
    expect(unclaimedSv).toContain(directoryProfileCopy.sv.sourceOwner);
    expect(unclaimedSv).not.toContain(directoryProfileCopy.sv.sourceOwnerClaimed);
    expect(unclaimedEn).toContain(directoryProfileCopy.en.sourceOwner);
    expect(unclaimedEn).not.toContain(directoryProfileCopy.en.sourceOwnerClaimed);
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

  it("does not let an existing profile relation bypass exact name classification when no canonical identity is persisted", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      if (query.includes("select service.id::text") && query.includes("from workspace_services service")) {
        return [{
          id: SERVICE_ID,
          name: "Hemstädning",
          previous_directory_service_slug: null,
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