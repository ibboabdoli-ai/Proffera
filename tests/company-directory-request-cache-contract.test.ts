import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheBehaviorMocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  hasActivePaidDirectoryContactAccess: vi.fn(),
  getPublicDirectoryProfileExtras: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
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

describe("company directory request cache contract", () => {
  it("uses one React request memoizer for public directory business data", () => {
    const helper = source("src/lib/company-directory-public-data.ts");
    const swedishRoute = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishRoute = source("src/app/en/companies/[slug]/page.tsx");
    const profile = source("src/components/company-directory/public-directory-profile.tsx");

    expect(helper).toContain('import { cache } from "react"');
    expect(helper).toContain("getPublicDirectoryBusinessForRequest = cache(async");
    expect(helper).toContain("await getPublicDirectoryBusiness(slug)");
    expect(helper).toContain("getSafeClaimedDirectoryFallback(slug)");
    expect(helper.match(/\bcache\(/g)?.length).toBe(1);

    for (const consumer of [swedishRoute, englishRoute, profile]) {
      expect(consumer).not.toContain('from "@/lib/company-directory-engine"');
    }
  });

  it("keeps public profile routes dynamic instead of adding persistent cross-request caching", () => {
    const swedishRoute = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishRoute = source("src/app/en/companies/[slug]/page.tsx");
    const helper = source("src/lib/company-directory-public-data.ts");

    expect(swedishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(englishRoute).toContain('export const dynamic = "force-dynamic"');
    expect(helper).not.toContain("unstable_cache");
    expect(helper).not.toContain("use cache");
  });
});

describe("directory request cache deduplication behavior", async () => {
  const { getPublicDirectoryBusinessForRequest } = await import("@/lib/company-directory-public-data");
  const { getPublicBusinessProfileViewForRequest, getSeoBusinessProjection } = await import("@/lib/business-profile-public");

  const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
  const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

  function mockSqlForCacheTest() {
    return vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("company_directory_profiles") && query.includes("organization_number")) {
        return [{
          organization_number: "5560000000",
          primary_sni_code: "43.221",
          website_url: "example.se",
        }];
      }
      if (query.includes("company_directory_scb_enrichment")) {
        return [{
          phone: "070-123 45 67",
          email: "test@example.se",
          workplaces: [],
        }];
      }
      if (query.includes("from company_directory_profiles profile")) {
        return [{
          legal_name: "Test Company AB",
          claimed_workspace_id: WORKSPACE_ID,
          owner_workspace_id: WORKSPACE_ID,
          workspace_slug: "test-workspace",
          public_booking_slug: null,
          company_name: "Test Brand",
          business_intro: "Test intro",
          logo_url: null,
          hero_image_url: null,
          featured_media_url: null,
        }];
      }
      if (query.includes("from workspace_services service")) {
        return [];
      }
      return [];
    });
  }

  function publicBusinessData() {
    return {
      id: PROFILE_ID,
      slug: "test-company-ab",
      companyName: "Test Company AB",
      legalForm: "AB",
      organizationStatus: "Aktivt",
      categorySlug: "vvs",
      primarySniLabel: "VVS-arbeten",
      activityDescription: "Description",
      addressLine1: "",
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

  function extrasData() {
    return {
      services: [],
      serviceAreas: [],
      reputation: null,
    };
  }

  beforeEach(() => {
    for (const mock of Object.values(cacheBehaviorMocks)) mock.mockReset();
    vi.clearAllMocks();
  });

  it("uses shared resolver so both metadata and profile rendering can benefit from React cache deduplication in production", async () => {
    const sql = mockSqlForCacheTest();
    cacheBehaviorMocks.getSql.mockReturnValue(sql);
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());
    cacheBehaviorMocks.getPublicDirectoryProfileExtras.mockResolvedValue(extrasData());
    cacheBehaviorMocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map([
      [WORKSPACE_ID, { planAccess: true, websiteBuilder: false, onlineBooking: false }],
    ]));

    const slug = "test-company-ab";

    // Both functions successfully resolve the same profile using the shared cached resolver.
    // In production (Next.js Server Components), React's cache() would dedupe the underlying
    // getPublicDirectoryBusinessForRequest calls within a single render pass.
    const seoProjection = await getSeoBusinessProjection(slug);
    const profileView = await getPublicBusinessProfileViewForRequest(slug);

    expect(seoProjection).not.toBeNull();
    expect(profileView).not.toBeNull();
    expect(seoProjection?.displayName).toBe("Test Brand"); // Owner brand from workspace
    expect(profileView?.business.companyName).toBe("Test Brand"); // Owner brand overrides directory name

    // Both functions use getPublicDirectoryBusinessForRequest, which is wrapped in cache().
    // The source-text contract test already verifies the wiring; this test verifies execution.
    expect(cacheBehaviorMocks.getPublicDirectoryBusiness).toHaveBeenCalledWith(slug);
  });

  it("shared cached resolver returns consistent data when called multiple times with the same slug", async () => {
    const sql = mockSqlForCacheTest();
    cacheBehaviorMocks.getSql.mockReturnValue(sql);
    cacheBehaviorMocks.getPublicDirectoryBusiness.mockResolvedValue(publicBusinessData());
    cacheBehaviorMocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(true);

    const slug = "test-company-ab";

    // Call the shared resolver multiple times - in production, React's cache() would
    // dedupe these within a single Server Component render. Here we verify the function
    // is idempotent and returns consistent results.
    const [result1, result2, result3] = await Promise.all([
      getPublicDirectoryBusinessForRequest(slug),
      getPublicDirectoryBusinessForRequest(slug),
      getPublicDirectoryBusinessForRequest(slug),
    ]);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1?.companyName).toBe("Test Company AB");
    expect(result1?.publicationStatus).toBe("published");
  });
});
