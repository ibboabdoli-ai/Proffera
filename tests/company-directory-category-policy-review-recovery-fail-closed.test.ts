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

type RecoveryRowState = {
  profileId: string;
  profileToken: string;
  factsToken: string;
  factsHash: string;
  scbHash: string;
  policyVersion: string;
  reviewRecoveryEvaluationPresent: boolean;
};

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

async function runRecoveryWithRowState(overrides: Partial<RecoveryRowState> = {}) {
  const state: RecoveryRowState = {
    profileId: PROFILE_ID,
    profileToken: PROFILE_TOKEN,
    factsToken: FACTS_TOKEN,
    factsHash: FACTS_HASH,
    scbHash: SCB_HASH,
    policyVersion: "test-policy-v1",
    reviewRecoveryEvaluationPresent: true,
    ...overrides,
  };
  let candidateRead = false;
  let recoveryAttempted = false;

  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = normalizeQuery(strings);

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

    if (query.includes("'decision', 'review_recovery_queued'")) {
      recoveryAttempted = true;
      const evidenceMatches = values[4] === state.profileId
        && values[5] === state.scbHash
        && values[6] === state.profileToken
        && values[7] === state.factsToken
        && values[9] === state.profileToken
        && values[10] === state.factsToken
        && values[11] === state.factsHash;

      if (!evidenceMatches) return [];

      state.policyVersion = String(values[0]);
      state.reviewRecoveryEvaluationPresent = false;
      return [{ profile_id: state.profileId }];
    }

    throw new Error(`Unexpected SQL in Review recovery fail-closed test: ${query}`);
  });

  mocks.getSql.mockReturnValue(sql);
  const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);
  return { result, state, recoveryAttempted };
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
  it("queues recovery only when all identity and evidence tokens still match", async () => {
    const { result, state, recoveryAttempted } = await runRecoveryWithRowState();

    expect(result).toMatchObject({
      selected: 1,
      evaluated: 1,
      kept: 1,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      remaining: 0,
    });
    expect(recoveryAttempted).toBe(true);
    expect(state.policyVersion).toBe("test-policy-v2");
    expect(state.reviewRecoveryEvaluationPresent).toBe(false);
    expect(mocks.assessConfidence).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["profile id", { profileId: "22222222-2222-4222-8222-222222222222" }],
    ["profile token", { profileToken: "2026-08-23 15:30:01+00" }],
    ["Official Facts token", { factsToken: "2026-08-23 15:31:01+00" }],
    ["Official Facts hash", { factsHash: "different-facts-hash" }],
    ["SCB hash", { scbHash: "different-scb-hash" }],
  ] satisfies Array<[string, Partial<RecoveryRowState>]>) (
    "fails closed when the current %s differs from the selected evidence",
    async (_label, overrides) => {
      const { result, state, recoveryAttempted } = await runRecoveryWithRowState(overrides);

      expect(result).toMatchObject({
        selected: 1,
        evaluated: 0,
        kept: 0,
        movedToReview: 0,
        deferred: 1,
        errors: 0,
        remaining: 1,
      });
      expect(recoveryAttempted).toBe(true);
      expect(state.policyVersion).toBe("test-policy-v1");
      expect(state.reviewRecoveryEvaluationPresent).toBe(true);
      expect(mocks.assessConfidence).toHaveBeenCalledTimes(1);
    },
  );
});
