import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  assessConfidence: vi.fn(),
  enrichOfficialFacts: vi.fn(),
  enrichScb: vi.fn(),
  createScbTransport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFactsForProfile: mocks.enrichOfficialFacts,
}));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.enrichScb,
}));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createScbTransport,
}));

import { revalidateAllCompanyDirectoryBatch } from "../src/lib/company-directory-full-revalidation";

const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const PROFILE_TOKEN = "2026-08-20 04:00:00.000000+00";
const FACTS_TOKEN = "2026-08-20 04:01:00.000000+00";

const transport = {
  fetchCompany: vi.fn(),
  fetchWorkplaces: vi.fn(),
};

function normalizeQuery(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  transport.fetchCompany.mockReset();
  transport.fetchWorkplaces.mockReset();

  mocks.createScbTransport.mockReturnValue(transport);
  mocks.enrichOfficialFacts.mockResolvedValue({ reusedVerifiedDetail: false });
  mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
  mocks.assessConfidence.mockReturnValue({ score: 70, officialFactsReady: true, reasons: [] });
});

describe("claimed Company Directory full revalidation", () => {
  it("selects a claimed profile, refreshes evidence, and never changes its status", async () => {
    const queries: string[] = [];

    const sql = vi.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
      const query = normalizeQuery(strings);
      if (query.includes("with blocked as (") && query.includes("for update of profile skip locked")) return [];
      queries.push(query);

      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID }];
      if (query.includes("select profile.id::text, profile.organization_number, profile.display_name, profile.publication_status")) {
        expect(query).toContain("profile.publication_status in ('published', 'ready', 'review', 'inactive', 'claimed')");
        return [{
          id: PROFILE_ID,
          organization_number: "5563115707",
          display_name: "Claimed Exempel AB",
          publication_status: "claimed",
        }];
      }
      if (query.includes("profile.category_slug") && query.includes("scb_snapshot_fresh")) {
        return [{
          id: PROFILE_ID,
          country_code: "SE",
          organization_kind: "juridical_person",
          publication_status: "claimed",
          category_slug: "elektriker",
          primary_sni_code: "43.210",
          legal_name: "Claimed Exempel AB",
          display_name: "Claimed Exempel AB",
          activity_description: "Elinstallation och service",
          is_active: true,
          privacy_blocked: false,
          auto_public_eligible: true,
          claimed_workspace_id: WORKSPACE_ID,
          profile_updated_token: PROFILE_TOKEN,
          registered_names: [],
          sni_codes: [{ code: "43.210", label: "Elinstallationer" }],
          deregistration_date: null,
          advertising_blocked: false,
          ongoing_procedures: [],
          facts_last_synced_token: FACTS_TOKEN,
          facts_source_payload_hash: "facts-hash",
          scb_source_payload_hash: "scb-hash",
          scb_conflict_count: 1,
          official_facts_fresh: true,
          scb_snapshot_fresh: true,
        }];
      }
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) {
        expect(query).toContain("profile.publication_status in ('published', 'ready', 'review', 'inactive', 'claimed')");
        return [{ count: 0 }];
      }
      if (query.includes("update company_directory_profiles profile")) {
        throw new Error("claimed profile status must never be changed by full revalidation");
      }
      throw new Error(`Unexpected SQL in claimed revalidation test: ${query}`);
    });

    mocks.getSql.mockReturnValue(sql);

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      refreshed: 1,
      kept: 1,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      remaining: 0,
    });
    expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
    expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
    expect(queries.some((query) => query.includes("update company_directory_profiles profile"))).toBe(false);
  });
});
