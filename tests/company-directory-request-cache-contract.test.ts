import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  hasActivePaidDirectoryContactAccess: vi.fn(),
  getPublicDirectoryProfileExtras: vi.fn(),
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
vi.mock("@/lib/company-directory-public-profile-extras", () => ({
  getPublicDirectoryProfileExtras: mocks.getPublicDirectoryProfileExtras,
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

import {
  PUBLIC_DIRECTORY_CACHE_TTL_SECONDS,
  invalidatePublicDirectoryExtrasCache,
  invalidatePublicDirectoryProfileCache,
  publicDirectoryExtrasCacheTag,
  publicDirectoryProfileCacheTag,
  setPublicDirectoryCacheAdapterForTests,
  type PublicDirectoryCacheAdapter,
  type PublicDirectoryCacheReadInput,
} from "@/lib/company-directory-public-cache";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";
import {
  getPublicBusinessProfileViewForRequest,
  getSeoBusinessProjection,
} from "@/lib/business-profile-public";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

type MemoryEntry = { value: unknown; tags: string[] };
const memoryEntries = new Map<string, MemoryEntry>();
const cacheReads: Array<{ keyParts: string[]; tags: string[]; revalidate: number }> = [];
const invalidatedTags: string[] = [];

const memoryCacheAdapter: PublicDirectoryCacheAdapter = {
  async read<T>(input: PublicDirectoryCacheReadInput<T>): Promise<T> {
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

function publicBusiness(slug = "test-company-ab", companyName = "Test Brand AB") {
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
  for (const mock of Object.values(mocks)) mock.mockReset();
});

afterEach(() => {
  setPublicDirectoryCacheAdapterForTests(null);
});

describe("company directory shared-cache route contract", () => {
  it("keeps both public routes dynamic and on the common resolver path", () => {
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
  it("turns 50 safe juridical reads into one underlying public lookup", async () => {
    mocks.getSql.mockReturnValue(publishedSql());
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness());

    const results = [];
    for (let index = 0; index < 50; index += 1) {
      results.push(await getPublicDirectoryBusinessForRequest("test-company-ab"));
    }

    expect(results).toHaveLength(50);
    expect(results.every((result) => result?.sharedCacheSafe === true)).toBe(true);
    expect(mocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(1);
    expect(mocks.hasActivePaidDirectoryContactAccess).not.toHaveBeenCalled();
  });

  it("uses a 300-second TTL and profile-specific tags for profile and extras", async () => {
    mocks.getSql.mockReturnValue(publishedSql());
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness());
    mocks.getPublicDirectoryProfileExtras.mockResolvedValue({ services: [], serviceAreas: [], reputation: null });

    await getPublicBusinessProfileViewForRequest("test-company-ab");

    expect(PUBLIC_DIRECTORY_CACHE_TTL_SECONDS).toBe(300);
    expect(cacheReads.length).toBeGreaterThanOrEqual(2);
    expect(cacheReads.every((read) => read.revalidate === 300)).toBe(true);
    expect(cacheReads.some((read) => read.tags.includes(publicDirectoryProfileCacheTag("test-company-ab")))).toBe(true);
    expect(cacheReads.some((read) => read.tags.includes(publicDirectoryExtrasCacheTag(PROFILE_ID)))).toBe(true);
  });

  it("reuses safe caches for metadata/page data without workspace entitlement reads", async () => {
    mocks.getSql.mockReturnValue(publishedSql());
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness());
    mocks.getPublicDirectoryProfileExtras.mockResolvedValue({ services: [], serviceAreas: [], reputation: null });

    const seo = await getSeoBusinessProjection("test-company-ab");
    const view = await getPublicBusinessProfileViewForRequest("test-company-ab");

    expect(seo?.displayName).toBe("Test Brand AB");
    expect(view?.business.companyName).toBe("Test Brand AB");
    expect(mocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(1);
    expect(mocks.getPublicDirectoryProfileExtras).toHaveBeenCalledTimes(1);
    expect(mocks.getWorkspaceDirectoryPublicAccessForWorkspaces).not.toHaveBeenCalled();
  });

  it("keeps registered legal name distinct from presentation name", async () => {
    mocks.getSql.mockReturnValue(publishedSql({ legalName: "Registered Legal Company AB" }));
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness("legal-name-company", "Customer Facing Brand"));
    mocks.getPublicDirectoryProfileExtras.mockResolvedValue({ services: [], serviceAreas: [], reputation: null });

    const view = await getPublicBusinessProfileViewForRequest("legal-name-company");
    expect(view?.profile.legal.legalName).toBe("Registered Legal Company AB");
    expect(view?.profile.presentation.displayName.value).toBe("Customer Facing Brand");
  });

  it("does not invent legalName when official legal_name is absent", async () => {
    mocks.getSql.mockReturnValue(publishedSql({ legalName: "" }));
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness("missing-legal-name", "Display Brand Only"));
    mocks.getPublicDirectoryProfileExtras.mockResolvedValue({ services: [], serviceAreas: [], reputation: null });

    const view = await getPublicBusinessProfileViewForRequest("missing-legal-name");
    expect(view?.profile.legal.legalName).toBe("");
    expect(view?.profile.presentation.displayName.value).toBe("Display Brand Only");
  });

  it("does not persist natural_person/sole-trader data across requests", async () => {
    mocks.getSql.mockReturnValue(publishedSql({ organizationKind: "natural_person" }));
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness("natural-person-business"));

    const first = await getPublicDirectoryBusinessForRequest("natural-person-business");
    const second = await getPublicDirectoryBusinessForRequest("natural-person-business");

    expect(first?.sharedCacheSafe).toBe(false);
    expect(second?.sharedCacheSafe).toBe(false);
    expect(mocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(2);
  });

  it("evaluates claimed paid-contact entitlement fresh on every request", async () => {
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
    mocks.getSql.mockReturnValue(sql);
    mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const first = await getPublicDirectoryBusinessForRequest(claimedSlug);
    const second = await getPublicDirectoryBusinessForRequest(claimedSlug);

    expect(first?.sharedCacheSafe).toBe(false);
    expect(first?.contact.entitled).toBe(false);
    expect(second?.sharedCacheSafe).toBe(false);
    expect(second?.contact.entitled).toBe(true);
    expect(mocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(2);
    expect(mocks.hasActivePaidDirectoryContactAccess).toHaveBeenCalledTimes(2);
  });

  it("profile invalidation evicts only that profile entry", async () => {
    mocks.getSql.mockReturnValue(publishedSql());
    mocks.getPublicDirectoryBusiness
      .mockResolvedValueOnce(publicBusiness("test-company-ab", "Brand Before"))
      .mockResolvedValueOnce(publicBusiness("test-company-ab", "Brand After"));

    const before = await getPublicDirectoryBusinessForRequest("test-company-ab");
    invalidatePublicDirectoryProfileCache("test-company-ab");
    const after = await getPublicDirectoryBusinessForRequest("test-company-ab");

    expect(before?.companyName).toBe("Brand Before");
    expect(after?.companyName).toBe("Brand After");
    expect(mocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(2);
    expect(invalidatedTags).toContain(publicDirectoryProfileCacheTag("test-company-ab"));
  });

  it("extras invalidation refreshes only the affected extras entry", async () => {
    mocks.getSql.mockReturnValue(publishedSql());
    mocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusiness());
    mocks.getPublicDirectoryProfileExtras
      .mockResolvedValueOnce({ services: [], serviceAreas: [], reputation: null })
      .mockResolvedValueOnce({ services: [], serviceAreas: [], reputation: null });

    await getPublicBusinessProfileViewForRequest("test-company-ab");
    invalidatePublicDirectoryExtrasCache(PROFILE_ID);
    await getPublicBusinessProfileViewForRequest("test-company-ab");

    expect(mocks.getPublicDirectoryProfileExtras).toHaveBeenCalledTimes(2);
    expect(invalidatedTags).toContain(publicDirectoryExtrasCacheTag(PROFILE_ID));
  });

  it("rejects malformed slug before any public DB lookup", async () => {
    mocks.getSql.mockReturnValue(publishedSql());
    expect(await getPublicDirectoryBusinessForRequest("../../private")).toBeNull();
    expect(mocks.getPublicDirectoryBusiness).not.toHaveBeenCalled();
  });
});
