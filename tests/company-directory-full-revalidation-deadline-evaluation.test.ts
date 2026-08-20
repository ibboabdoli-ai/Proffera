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
const PROFILE_TOKEN = "2026-08-20 04:00:00.000000+00";
const FACTS_TOKEN = "2026-08-20 04:01:00.000000+00";
const FACTS_HASH = "facts-hash";
const SCB_HASH = "scb-hash";

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
  mocks.enrichOfficialFacts.mockResolvedValue({
    profileId: PROFILE_ID,
    organizationNumber: "5563115707",
    reusedVerifiedDetail: false,
  });
  mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
  mocks.assessConfidence.mockReturnValue({ score: 90, officialFactsReady: true, reasons: [] });
});

describe("full Company Directory evaluation deadline", () => {
  it("does not start a Ready-to-Review update when evaluation finishes at the deadline", async () => {
    let now = 1_000;
    const deadlineAt = 50_000;
    let pendingEvaluationMarked = false;
    const queries: string[] = [];
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);

    const sql = vi.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
      const query = normalizeQuery(strings);
      queries.push(query);

      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID }];
      if (query.includes("select profile.id::text, profile.organization_number, profile.display_name, profile.publication_status")) {
        return [{
          id: PROFILE_ID,
          organization_number: "5563115707",
          display_name: "Exempel El AB",
          publication_status: "ready",
        }];
      }
      if (query.includes("profile.category_slug") && query.includes("scb_snapshot_fresh")) {
        now = deadlineAt;
        return [{
          id: PROFILE_ID,
          country_code: "SE",
          organization_kind: "juridical_person",
          publication_status: "ready",
          category_slug: "elektriker",
          primary_sni_code: "43.210",
          legal_name: "Exempel El AB",
          display_name: "Exempel El AB",
          activity_description: "Elinstallation och service",
          is_active: true,
          privacy_blocked: false,
          auto_public_eligible: true,
          claimed_workspace_id: null,
          profile_updated_token: PROFILE_TOKEN,
          registered_names: [],
          sni_codes: [{ code: "43.210", label: "Elinstallationer" }],
          deregistration_date: null,
          advertising_blocked: false,
          ongoing_procedures: [],
          facts_last_synced_token: FACTS_TOKEN,
          facts_source_payload_hash: FACTS_HASH,
          scb_source_payload_hash: SCB_HASH,
          scb_conflict_count: 0,
          official_facts_fresh: true,
          scb_snapshot_fresh: true,
        }];
      }
      if (query.includes("update company_directory_scb_enrichment") && query.includes("officialFactsLastSyncedToken")) {
        pendingEvaluationMarked = true;
        return [];
      }
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: pendingEvaluationMarked ? 1 : 0 }];
      if (query.includes("update company_directory_profiles profile")) {
        throw new Error("profile status update must not start after the deadline");
      }
      throw new Error(`Unexpected SQL in evaluation-deadline test: ${query}`);
    });

    mocks.getSql.mockReturnValue(sql);

    try {
      const result = await revalidateAllCompanyDirectoryBatch(10, { deadlineAt });

      expect(result).toMatchObject({
        selected: 1,
        refreshed: 1,
        movedToReview: 0,
        deferred: 1,
        errors: 0,
        remaining: 1,
      });
      expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
      expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
      expect(pendingEvaluationMarked).toBe(true);
      expect(queries.some((query) => query.includes("update company_directory_profiles profile"))).toBe(false);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
