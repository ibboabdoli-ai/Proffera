import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheBehaviorMocks = vi.hoisted(() => {
  const persistentStores: Array<Map<string, unknown>> = [];
  return {
    persistentStores,
    unstableCache: vi.fn((fn: (...args: unknown[]) => unknown) => {
      const store = new Map<string, unknown>();
      persistentStores.push(store);
      return async (...args: unknown[]) => {
        const key = JSON.stringify(args);
        if (store.has(key)) return store.get(key);
        const value = await fn(...args);
        store.set(key, value);
        return value;
      };
    }),
    getSql: vi.fn(),
    getPublicDirectoryBusiness: vi.fn(),
    hasActivePaidDirectoryContactAccess: vi.fn(),
    getPublicDirectoryProfileExtras: vi.fn(),
    getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));
vi.mock("next/cache", () => ({ unstable_cache: cacheBehaviorMocks.unstableCache }));
vi.mock("@/lib/db/server", () => ({ getSql: cacheBehaviorMocks.getSql }));
vi.mock("@/lib/company-directory-engine", () => ({
  getPublicDirectoryBusiness: cacheBehaviorMocks.getPublicDirectoryBusiness,
}));
vi.mock("@/lib/company-directory-paid-contact-entitlement", () => ({
  hasActivePaidDirectoryContactAccess: cacheBehaviorMocks.hasActivePaidDirectoryContactAccess,
}));
vi.mock("@/lib/company-directory-public-profile-extras", () => ({
  getPublicDirectoryProfileExtras: cacheBehaviorMocks.getPublicDirectoryProfileExtras,
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: cacheBehaviorMocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory shared-cache security and scale contract", () => {
  it("keeps dynamic routes while adding a bounded shared cache only for safe published juridical data", () => {
    const helper = source("src/lib/company-directory-public-data.ts");
    const profileResolver = source("src/lib/business-profile-public.ts");
    const swedishRoute = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishRoute = source("src/app/en/companies/[slug]/page.tsx");
    const profile = source("src/components/company-directory/public-directory-profile.tsx");

    expect(helper).toContain('import { cache } from "react"');
    expect(helper).toContain('import { unstable_cache } from "next/cache"');
    expect(helper).toContain("PUBLIC_DIRECTORY_REVALIDATE_SECONDS = 5 * 60");
    expect(helper).toContain('"public-directory-published-juridical-v1"');
    expect(helper).toContain("published?.organizationNumber ? published : null");
    expect(helper).toContain("getSafeClaimedDirectoryFallback(normalized)");
    expect(helper).toContain("hasActivePaidDirectoryContactAccess(workspaceId)");
    expect(helper).toContain("const cachedPublished = await readCachedPublishedJuridicalDirectoryBusiness(normalized)");
    expect(helper).toContain("const published = await resolvePublishedDirectoryBusiness(normalized)");
    expect(helper).toContain("getPublicDirectoryBusinessForRequest = cache(async");
    expect(helper.match(/\bunstable_cache\(/g)?.length).toBe(1);
    expect(helper.match(/\bcache\(/g)?.length).toBe(1);

    expect(profileResolver).toContain('import { unstable_cache } from "next/cache"');
    expect(profileResolver).toContain("PUBLIC_PROFILE_EXTRAS_REVALIDATE_SECONDS = 5 * 60");
    expect(profileResolver).toContain('"public-directory-profile-extras-v1"');
    expect(profileResolver).toContain('business.publicationStatus === "published" && Boolean(business.organizationNumber)');
    expect(profileResolver).toContain("? await readCachedPublicDirectoryProfileExtras(business.id)");
    expect(profileResolver).toContain(": await getProfileOwnerContext(business.id)");
    expect(profileResolver).toContain(": await getProfileEntitlements(");

    expect(swedishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(englishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(swedishRoute).toContain("getSeoBusinessProjection(slug)");
    expect(englishRoute).toContain("getSeoBusinessProjection(slug)");
    expect(profile).toContain("getPublicBusinessProfileViewForRequest(slug)");

    for (const consumer of [swedishRoute, englishRoute, profile]) {
      expect(consumer).not.toContain('from "@/lib/company-directory-engine"');
    }
  });

  it("keeps claim, paid-contact and sole-trader paths outside the persistent cache closure", () => {
    const helper = source("src/lib/company-directory-public-data.ts");
    const cacheStart = helper.indexOf("const readCachedPublishedJuridicalDirectoryBusiness");
    const claimedStart = helper.indexOf("async function getSafeClaimedDirectoryFallback");
    const requestStart = helper.indexOf("export const getPublicDirectoryBusinessForRequest");

    expect(cacheStart).toBeGreaterThan(-1);
    expect(claimedStart).toBeGreaterThan(cacheStart);
    expect(requestStart).toBeGreaterThan(claimedStart);

    const sharedCacheClosure = helper.slice(cacheStart, claimedStart);
    expect(sharedCacheClosure).not.toContain("hasActivePaidDirectoryContactAccess");
    expect(sharedCacheClosure).not.toContain("getSafeClaimedDirectoryFallback");
    expect(sharedCacheClosure).not.toContain("claimed_workspace_id");
    expect(sharedCacheClosure).toContain("published?.organizationNumber ? published : null");

    const claimedPath = helper.slice(claimedStart, requestStart);
    expect(claimedPath).toContain("publication_status = 'claimed'");
    expect(claimedPath).toContain("hasActivePaidDirectoryContactAccess(workspaceId)");

    // A cached miss is deliberately re-resolved outside unstable_cache. That is
    // the fail-closed path for published sole traders and claimed profiles.
    const requestPath = helper.slice(requestStart);
    expect(requestPath).toContain("const published = await resolvePublishedDirectoryBusiness(normalized)");
    expect(requestPath).toContain("return getSafeClaimedDirectoryFallback(normalized)");
  });
});

describe("directory shared-cache behavior", async () => {
  const { getPublicDirectoryBusinessForRequest } = await import("@/lib/company-directory-public-data");
  const { getPublicBusinessProfileViewForRequest, getSeoBusinessProjection } = await import("@/lib/business-profile-public");

  const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
  const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

  function publicBusinessData(slug = "test-company-ab") {
    return {
      id: PROFILE_ID,
      slug,
      companyName: "Test Company AB",
      legalForm: "AB",
      organizationStatus: "Aktivt",
      categorySlug: "vvs",
      primarySniLabel: "VVS-arbeten",
      activityDescription: "Description",
      addressLine1: "Storgatan 1",
      postalCode: "151 00",
      city: "Södertälje",
      municipality: "Södertälje",
      region: "Stockholm",
      qualityScore: 95,
      officialSource: "bolagsverket",
      sourceUpdatedAt: "2026-08-23T00:00:00.000Z",
      lastCheckedAt: "2026-08-23T00:00:00.000Z",
      media: null,
    };
  }

  function publishedSql() {
    return vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("from company_directory_profiles") && query.includes("organization_number")) {
        return [{
          organization_number: "5560000000",
          organization_kind: "juridical_person",
          primary_sni_code: "43.221",
          website_url: "example.se",
          claimed_workspace_id: null,
        }];
      }
      if (query.includes("company_directory_scb_enrichment")) {
        return [{ phone: "070-123 45 67", email: "test@example.se", workplaces: [] }];
      }
      return [];
    });
  }

  beforeEach(() => {
    for (const store of cacheBehaviorMocks.persistentStores) store.clear();
    cacheBehaviorMocks.getSql.mockReset();
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockReset();
    cacheBehaviorMocks.hasActivePaidDirectoryContactAccess.mockReset();
    cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockReset();
    cacheBehaviorMocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockReset();
    vi.clearAllMocks();
  });

  it("turns a burst of repeated public juridical profile reads into one underlying published lookup", async () => {
    const sql = publishedSql();
    cacheBehaviorMocks.getSql.mockReturnValue(sql);
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());

    const results = [];
    for (let index = 0; index < 50; index += 1) {
      results.push(await getPublicDirectoryBusinessForRequest("test-company-ab"));
    }

    expect(results).toHaveLength(50);
    expect(results.every((result) => result?.organizationNumber === "5560000000")).toBe(true);
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(1);
    expect(cacheBehaviorMocks.hasActivePaidDirectoryContactAccess).not.toHaveBeenCalled();
  });

  it("reuses the same safe caches for metadata and page data without loading workspace entitlements", async () => {
    const sql = publishedSql();
    cacheBehaviorMocks.getSql.mockReturnValue(sql);
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());
    cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockResolvedValue({
      services: [],
      serviceAreas: [],
      reputation: null,
    });

    const seoProjection = await getSeoBusinessProjection("test-company-ab");
    const profileView = await getPublicBusinessProfileViewForRequest("test-company-ab");

    expect(seoProjection?.displayName).toBe("Test Company AB");
    expect(profileView?.business.companyName).toBe("Test Company AB");
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(1);
    expect(cacheBehaviorMocks.getPublicDirectoryProfileExtras).toHaveBeenCalledTimes(1);
    expect(cacheBehaviorMocks.getWorkspaceDirectoryPublicAccessForWorkspaces).not.toHaveBeenCalled();
  });

  it("does not persist claimed entitlement decisions across requests", async () => {
    const claimedSlug = "claimed-company";
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("from company_directory_profiles profile") && query.includes("publication_status = 'claimed'")) {
        return [{
          id: PROFILE_ID,
          public_slug: claimedSlug,
          organization_number: "5560000000",
          organization_kind: "juridical_person",
          display_name: "Claimed Company AB",
          legal_form: "AB",
          organization_status: "Aktivt",
          category_slug: "vvs",
          primary_sni_code: "43.221",
          primary_sni_label: "VVS-arbeten",
          activity_description: "Claimed description",
          address_line1: "Storgatan 1",
          postal_code: "151 00",
          city: "Södertälje",
          municipality: "Södertälje",
          region: "Stockholm",
          website_url: "example.se",
          quality_score: 95,
          official_source: "bolagsverket",
          source_updated_at: "2026-08-23T00:00:00.000Z",
          last_synced_at: "2026-08-23T00:00:00.000Z",
          claimed_workspace_id: WORKSPACE_ID,
          media_url: null,
        }];
      }
      if (query.includes("company_directory_scb_enrichment")) {
        return [{ phone: "070-123 45 67", email: "test@example.se", workplaces: [] }];
      }
      if (query.includes("company_directory_profile_locations")) return [];
      return [];
    });
    cacheBehaviorMocks.getSql.mockReturnValue(sql);
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    cacheBehaviorMocks.hasActivePaidDirectoryContactAccess
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const first = await getPublicDirectoryBusinessForRequest(claimedSlug);
    const second = await getPublicDirectoryBusinessForRequest(claimedSlug);

    expect(first?.publicationStatus).toBe("claimed");
    expect(first?.contact.entitled).toBe(false);
    expect(second?.publicationStatus).toBe("claimed");
    expect(second?.contact.entitled).toBe(true);
    expect(cacheBehaviorMocks.hasActivePaidDirectoryContactAccess).toHaveBeenCalledTimes(2);
  });

  it("fails malformed slugs before any database-backed public lookup", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql());
    expect(await getPublicDirectoryBusinessForRequest("../../private")).toBeNull();
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).not.toHaveBeenCalled();
  });
});
