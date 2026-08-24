import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  assessConfidence: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION: "test-policy-v2",
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));

import { revalidateCompanyDirectoryCategoryPolicyBatch } from "../src/lib/company-directory-category-policy-revalidation";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_TOKEN = "2026-08-23 15:30:00+00";
const FACTS_TOKEN = "2026-08-23 15:31:00+00";
const FACTS_HASH = "facts-hash";
const SCB_HASH = "scb-hash";

function normalizeQuery(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function reviewCandidate() {
  return {
    id: PROFILE_ID,
    organization_number: "5563115707",
    publication_status: "review",
    category_slug: "elektriker",
    primary_sni_code: "43.210",
    legal_name: "Exempel El AB",
    display_name: "Exempel El AB",
    activity_description: "Elinstallation och elservice",
    is_active: true,
    privacy_blocked: false,
    auto_public_eligible: true,
    profile_updated_token: PROFILE_TOKEN,
    registered_names: [{
      name: "Exempel El AB",
      typeCode: "FORETAGSNAMN",
      specialBusinessDescription: "",
    }],
    sni_codes: [{ code: "43210", label: "Elinstallationer" }],
    deregistration_date: null,
    advertising_blocked: false,
    ongoing_procedures: [],
    facts_last_synced_token: FACTS_TOKEN,
    facts_source_payload_hash: FACTS_HASH,
    scb_source_payload_hash: SCB_HASH,
    scb_conflict_count: 0,
    policy_backlog_count: 1,
  };
}

beforeEach(() => {
  mocks.getSql.mockReset();
  mocks.assessConfidence.mockReset();
  mocks.assessConfidence.mockReturnValue({
    score: 95,
    officialFactsReady: true,
    competingCategories: [],
    conflictingTextCategories: [],
  });
});

describe("Company Directory category-policy Review recovery", () => {
  it("fails closed when the recovery write loses its evidence-bound race", async () => {
    const sqlCalls: string[] = [];
    let candidateRead = false;

    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = normalizeQuery(strings);
      sqlCalls.push(query);

      if (query.includes("select profile.id::text") && query.includes("categoryConfidencePolicy")) {
        if (candidateRead) return [];
        candidateRead = true;
        return [reviewCandidate()];
      }

      if (
        query.includes("update company_directory_scb_enrichment scb")
        && query.includes("categoryConfidencePolicyLastAttemptAt")
      ) {
        return [{ profile_id: PROFILE_ID }];
      }

      if (query.includes("#- '{reviewRecoveryEvaluation}'")) {
        return [];
      }

      throw new Error(`Unexpected SQL in Review recovery fail-closed test: ${query}`);
    });

    mocks.getSql.mockReturnValue(sql);

    const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      evaluated: 0,
      kept: 0,
      movedToReview: 0,
      deferred: 1,
      errors: 0,
      remaining: 1,
    });
    expect(mocks.assessConfidence).toHaveBeenCalledTimes(1);
    expect(sqlCalls.some((query) => query.includes("#- '{reviewRecoveryEvaluation}'"))).toBe(true);
    expect(sqlCalls.some((query) => query.includes("set publication_status = 'ready'"))).toBe(false);
    expect(sqlCalls.some((query) => query.includes("with moved_profile as"))).toBe(false);
  });
});
