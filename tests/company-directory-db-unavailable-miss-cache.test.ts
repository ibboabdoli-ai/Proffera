import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  hasActivePaidDirectoryContactAccess: vi.fn(),
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

import {
  setPublicDirectoryCacheAdapterForTests,
  type PublicDirectoryCacheAdapter,
  type PublicDirectoryCacheReadInput,
} from "@/lib/company-directory-public-cache";
import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";

type MemoryEntry = { value: unknown; tags: string[] };
const memoryEntries = new Map<string, MemoryEntry>();

const memoryCacheAdapter: PublicDirectoryCacheAdapter = {
  async read<T>(input: PublicDirectoryCacheReadInput<T>): Promise<T> {
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
    for (const [key, entry] of memoryEntries) {
      if (entry.tags.includes(tag)) memoryEntries.delete(key);
    }
  },
};

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const SLUG = "recovered-claimed-company";

beforeEach(() => {
  memoryEntries.clear();
  setPublicDirectoryCacheAdapterForTests(memoryCacheAdapter);
  for (const mock of Object.values(mocks)) mock.mockReset();
});

afterEach(() => {
  setPublicDirectoryCacheAdapterForTests(null);
});

describe("Directory miss cache database availability", () => {
  it("does not persist an unavailable database as a company miss", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("from company_directory_profiles profile") && query.includes("publication_status = 'claimed'")) {
        return [{
          id: PROFILE_ID,
          public_slug: SLUG,
          organization_number: "5560000000",
          organization_kind: "juridical_person",
          legal_name: "Recovered Claimed AB",
          display_name: "Recovered Claimed AB",
          legal_form: "AB",
          organization_status: "Aktivt",
          category_slug: "vvs",
          primary_sni_code: "43.221",
          primary_sni_label: "VVS-arbeten",
          activity_description: "Recovered after a transient database outage",
          address_line1: "",
          postal_code: "151 00",
          city: "Södertälje",
          municipality: "Södertälje",
          region: "Stockholm",
          website_url: "",
          quality_score: 95,
          official_source: "bolagsverket",
          source_updated_at: "2026-09-17T00:00:00.000Z",
          official_facts_last_synced_at: "2026-09-17T00:00:00.000Z",
          claimed_workspace_id: WORKSPACE_ID,
          media_url: null,
        }];
      }
      if (query.includes("company_directory_scb_enrichment")) {
        return [{ phone: "", email: "", workplaces: [] }];
      }
      if (query.includes("company_directory_profile_locations")) return [];
      return [];
    });

    mocks.getPublicDirectoryBusiness.mockResolvedValue(null);
    mocks.hasActivePaidDirectoryContactAccess.mockResolvedValue(false);
    // The miss-cache boundary and claimed fallback each check DB availability
    // during the first request, so keep both reads unavailable before recovery.
    mocks.getSql
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValue(sql);

    expect(await getPublicDirectoryBusinessForRequest(SLUG)).toBeNull();

    const recovered = await getPublicDirectoryBusinessForRequest(SLUG);

    expect(recovered?.publicationStatus).toBe("claimed");
    expect(recovered?.slug).toBe(SLUG);
    expect(recovered?.companyName).toBe("Recovered Claimed AB");
    expect(mocks.getPublicDirectoryBusiness).toHaveBeenCalledTimes(2);
    expect(sql).toHaveBeenCalled();
  });
});
