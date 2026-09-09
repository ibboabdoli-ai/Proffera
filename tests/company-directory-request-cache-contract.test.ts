import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cacheBehaviorMocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  hasActivePaidDirectoryContactAccess: vi.fn(),
  getPublicDirectoryProfileExtras: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));
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

import {
  PUBLIC_DIRECTORY_CACHE_TTL_SECONDS,
  invalidatePublicDirectoryExtrasCache,
  invalidatePublicDirectoryProfileCache,
  publicDirectoryExtrasCacheTag,
  publicDirectoryProfileCacheTag,
  setPublicDirectoryCacheAdapterForTests,
  type PublicDirectoryCacheAdapter,
} from "@/lib/company-directory-public-cache";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import { getPublicBusinessProfileViewForRequest, getSeoBusinessProjection } from "@/lib/business-profile-public";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

type MemoryEntry = { value: unknown; tags: string[] };
const memoryEntries = new Map<string, MemoryEntry>();
const cacheReads: Array<{ keyParts: string[]; tags: string[]; revalidate: number }> = [];
const invalidatedTags: string[] = [];

const memoryCacheAdapter: PublicDirectoryCacheAdapter = {
  async read<T>(input): Promise<T> {
    cacheReads.push({
      keyParts: [...input.keyParts],
      tags: [...input.tags],
      revalidate: input.revalidate,
    });
    const key = JSON.stringify(input.keyParts);
    const existing = memoryEntries.get(key);
    if (existing) return existing.value as T;

    const decision = await input.loader();
    if (decision.cache) {
      memoryEntries.set(key, { value: decision.value, tags: [...input.tags] });
    }
    return decision.value;
  },
  invalidate(tag: string) {
    invalidatedTags.push(tag);
    for (const [key, entry] of memoryEntries) {
      if (entry.tags.includes(tag)) memoryEntries.delete(key);
    }
  },
};

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

function publicBusinessData(slug = "test-company-ab", companyName = "Test Brand AB") {
  return {
    id: PROFILE_ID,
    slug,
    companyName,
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

function publishedSql(input: {
  organizationKind?: string;
  legalName?: string;
  claimedWorkspaceId?: string | null;
} = {}) {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("from company_directory_profiles") && query.includes("organization_number")) {
      return [{
        organization_number: "5560000000",
        organization_kind: input.organizationKind ?? "juridical_person",
        legal_name: input.legalName ?? "Registered Legal AB",
        primary_sni_code: "43.221",
        website_url: "example.se",
        claimed_workspace_id: input.claimedWorkspaceId ?? null,
      }];
    }
    if (query.includes("company_directory_scb_enrichment")) {
      return [{ phone: "070-123 45 67", email: "test@example.se", workplaces: [] }];
    }
    return [];
  });
}

beforeEach(() => {
  memoryEntries.clear();
  cacheReads.length = 0;
  invalidatedTags.length = 0;
  setPublicDirectoryCacheAdapterForTests(memoryCacheAdapter);

  cacheBehaviorMocks.getSql.mockReset();
  cacheBehaviorMocks.getPublicDirectoryBusiness.mockReset();
  cacheBehaviorMocks.hasActivePaidDirectoryContactAccess.mockReset();
  cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockReset();
  cacheBehaviorMocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockReset();
  vi.clearAllMocks();
});

afterEach(() => {
  setPublicDirectoryCacheAdapterForTests(null);
});

describe("company directory shared-cache route contract", () => {
  it("keeps both public profile routes dynamic and on the common resolver path", () => {
    const swedishRoute = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishRoute = source("src/app/en/companies/[slug]/page.tsx");
    const profile = source("src/components/company-directory/public-directory-profile.tsx");

    expect(swedishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(englishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(swedishRoute).toContain("getSeoBusinessProjection(slug)");
    expect(englishRoute).toContain("getSeoBusinessProjection(slug)");
    expect(profile).toContain("getPublicBusinessProfileViewForRequest(slug)");

    for (const consumer of [swedishRoute, englishRoute, profile]) {
      expect(consumer).not.toContain('from "@/lib/company-directory-engine"');
    }
  });
});

describe("directory shared-cache behavior", () => {
  it("turns 50 safe public juridical reads into one underlying published lookup", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql());
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());

    const results = [];
    for (let index = 0; index < 50; index += 1) {
      results.push(await getPublicDirectoryBusinessForRequest("test-company-ab"));
    }

    expect(results).toHaveLength(50);
    expect(results.every((result) => result?.organizationNumber === "5560000000")).toBe(true);
    expect(results.every((result) => result?.sharedCacheSafe === true)).toBe(true);
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(1);
    expect(cacheBehaviorMocks.hasActivePaidDirectoryContactAccess).not.toHaveBeenCalled();
  });

  it("configures a five-minute TTL and profile-specific tags for shared profile and extras data", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql());
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());
    cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockResolvedValue({
      services: [],
      serviceAreas: [],
      reputation: null,
    });

    await getPublicBusinessProfileViewForRequest("test-company-ab");

    expect(PUBLIC_DIRECTORY_CACHE_TTL_SECONDS).toBe(300);
    expect(cacheReads.length).toBeGreaterThanOrEqual(2);
    expect(cacheReads.every((read) => read.revalidate === 300)).toBe(true);
    expect(cacheReads.some((read) => read.tags.includes(publicDirectoryProfileCacheTag("test-company-ab")))).toBe(true);
    expect(cacheReads.some((read) => read.tags.includes(publicDirectoryExtrasCacheTag(PROFILE_ID)))).toBe(true);
  });

  it("reuses the same safe caches for metadata and page data without loading workspace entitlements", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql());
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());
    cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockResolvedValue({
      services: [],
      serviceAreas: [],
      reputation: null,
    });

    const seoProjection = await getSeoBusinessProjection("test-company-ab");
    const profileView = await getPublicBusinessProfileViewForRequest("test-company-ab");

    expect(seoProjection?.displayName).toBe("Test Brand AB");
    expect(profileView?.business.companyName).toBe("Test Brand AB");
    expect(profileView?.business.sharedCacheSafe).toBe(true);
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(1);
    expect(cacheBehaviorMocks.getPublicDirectoryProfileExtras).toHaveBeenCalledTimes(1);
    expect(cacheBehaviorMocks.getWorkspaceDirectoryPublicAccessForWorkspaces).not.toHaveBeenCalled();
  });

  it("keeps the registered legal name distinct from the display brand", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql({ legalName: "Registered Legal Company AB" }));
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(
      publicBusinessData("legal-name-company", "Customer Facing Brand"),
    );
    cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockResolvedValue({
      services: [],
      serviceAreas: [],
      reputation: null,
    });

    const view = await getPublicBusinessProfileViewForRequest("legal-name-company");

    expect(view?.profile.legal.legalName).toBe("Registered Legal Company AB");
    expect(view?.profile.presentation.displayName.value).toBe("Customer Facing Brand");
  });

  it("does not invent a legal name when the official legal_name is absent", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql({ legalName: "" }));
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(
      publicBusinessData("missing-legal-name", "Display Brand Only"),
    );
    cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockResolvedValue({
      services: [],
      serviceAreas: [],
      reputation: null,
    });

    const view = await getPublicBusinessProfileViewForRequest("missing-legal-name");

    expect(view?.profile.legal.legalName).toBe("");
    expect(view?.profile.presentation.displayName.value).toBe("Display Brand Only");
  });

  it("does not persist natural-person/sole-trader published data across requests", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql({ organizationKind: "natural_person" }));
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(
      publicBusinessData("natural-person-business", "Natural Person Business"),
    );

    const first = await getPublicDirectoryBusinessForRequest("natural-person-business");
    const second = await getPublicDirectoryBusinessForRequest("natural-person-business");

    expect(first?.sharedCacheSafe).toBe(false);
    expect(second?.sharedCacheSafe).toBe(false);
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(2);
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
          legal_name: "Claimed Legal AB",
          display_name: "Claimed Brand",
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
    expect(first?.sharedCacheSafe).toBe(false);
    expect(first?.contact.entitled).toBe(false);
    expect(second?.publicationStatus).toBe("claimed");
    expect(second?.sharedCacheSafe).toBe(false);
    expect(second?.contact.entitled).toBe(true);
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(2);
    expect(cacheBehaviorMocks.hasActivePaidDirectoryContactAccess).toHaveBeenCalledTimes(2);
  });

  it("invalidates only the affected public profile cache entry", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql());
    cacheBehaviorMocks.getPublicDirectoryBusiness
      .mockResolvedValueOnce(publicBusinessData("test-company-ab", "Brand Before"))
      .mockResolvedValueOnce(publicBusinessData("test-company-ab", "Brand After"));

    const before = await getPublicDirectoryBusinessForRequest("test-company-ab");
    invalidatePublicDirectoryProfileCache("test-company-ab");
    const after = await getPublicDirectoryBusinessForRequest("test-company-ab");

    expect(before?.companyName).toBe("Brand Before");
    expect(after?.companyName).toBe("Brand After");
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(2);
    expect(invalidatedTags).toContain(publicDirectoryProfileCacheTag("test-company-ab"));
  });

  it("invalidates public extras independently for the affected profile", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql());
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());
    cacheBehaviorMocks.getPublicDirectoryProfileExtras
      .mockResolvedValueOnce({ services: [], serviceAreas: [], reputation: null })
      .mockResolvedValueOnce({ services: [], serviceAreas: [], reputation: null });

    await getPublicBusinessProfileViewForRequest("test-company-ab");
    invalidatePublicDirectoryExtrasCache(PROFILE_ID);
    await getPublicBusinessProfileViewForRequest("test-company-ab");

    expect(cacheBehaviorMocks.getPublicDirectoryProfileExtras).toHaveBeenCalledTimes(2);
    expect(invalidatedTags).toContain(publicDirectoryExtrasCacheTag(PROFILE_ID));
  });

  it("fails malformed slugs before any database-backed public lookup", async () => {
    cacheBehaviorMocks.getSql.mockReturnValue(publishedSql());

    expect(await getPublicDirectoryBusinessForRequest("../../private")).toBeNull();
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).not.toHaveBeenCalled();
  });
});
