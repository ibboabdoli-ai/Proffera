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

type SqlCall = { query: string; values: unknown[] };
type SqlResponder = (query: string, values: unknown[]) => Promise<unknown[]> | unknown[];

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_TOKEN = "2026-08-23 15:30:00+00";
const FACTS_TOKEN = "2026-08-23 15:31:00+00";
const FACTS_HASH = "facts-hash";
const SCB_HASH = "scb-hash";

let sqlCalls: SqlCall[] = [];
let responder: SqlResponder;
let sql: ReturnType<typeof vi.fn>;

function normalizeQuery(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function candidate(status: "published" | "ready" = "ready") {
  return {
    id: PROFILE_ID,
    organization_number: "5563115707",
    publication_status: status,
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

function configure(input: {
  status?: "published" | "ready";
  attemptRows?: unknown[];
  markRows?: unknown[];
  moveRows?: unknown[];
  moveError?: Error;
  backlog?: number;
} = {}) {
  const row = candidate(input.status ?? "ready");
  let candidateReads = 0;

  responder = async (query) => {
    if (query.includes("select profile.id::text") && query.includes("categoryConfidencePolicy")) {
      candidateReads += 1;
      if (candidateReads === 1) return [row];
      const backlog = input.backlog ?? 0;
      return backlog > 0 ? [{ ...row, policy_backlog_count: backlog }] : [];
    }
    if (
      query.includes("update company_directory_scb_enrichment scb")
      && query.includes("categoryConfidencePolicyLastAttemptAt")
    ) {
      return input.attemptRows ?? [{ profile_id: PROFILE_ID }];
    }
    if (query.includes("with moved_profile as")) {
      if (input.moveError) throw input.moveError;
      return input.moveRows ?? [{ profile_id: PROFILE_ID }];
    }
    if (query.includes("update company_directory_scb_enrichment scb")) {
      return input.markRows ?? [{ profile_id: PROFILE_ID }];
    }
    throw new Error(`Unexpected SQL in category policy revalidation test: ${query}`);
  };
}

beforeEach(() => {
  sqlCalls = [];
  responder = async () => [];
  sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = normalizeQuery(strings);
    sqlCalls.push({ query, values });
    return await responder(query, values);
  });

  mocks.getSql.mockReset();
  mocks.assessConfidence.mockReset();
  mocks.getSql.mockReturnValue(sql);
  mocks.assessConfidence.mockReturnValue({
    score: 95,
    officialFactsReady: true,
    competingCategories: [],
    conflictingTextCategories: [],
  });
});

describe("Company Directory category policy revalidation", () => {
  it("clamps an oversized batch request to the safe maximum", async () => {
    configure();

    await revalidateCompanyDirectoryCategoryPolicyBatch(500);

    const selection = sqlCalls.find((call) => call.query.includes("select profile.id::text"));
    expect(selection?.values).toContain(20);
  });

  it("clamps a non-positive batch request to one candidate", async () => {
    configure();

    await revalidateCompanyDirectoryCategoryPolicyBatch(0);

    const selection = sqlCalls.find((call) => call.query.includes("select profile.id::text"));
    expect(selection?.values).toContain(1);
  });

  it("derives remaining backlog from the initial selection without a second candidate scan", async () => {
    configure();

    const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    expect(result.remaining).toBe(0);
    expect(sqlCalls.filter((call) => call.query.includes("select profile.id::text"))).toHaveLength(1);
  });

  it("passes one deadline AbortSignal through every Neon SQL client", async () => {
    configure();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      await revalidateCompanyDirectoryCategoryPolicyBatch(10, {
        deadlineAt: 1_100_000,
      });

      const signals = mocks.getSql.mock.calls.map((call) => call[0]?.signal);
      expect(signals.length).toBeGreaterThan(1);
      expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
      expect(new Set(signals).size).toBe(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("demotes a stale-policy Ready profile and records the policy decision in the same statement", async () => {
    configure({ status: "ready" });
    mocks.assessConfidence.mockReturnValue({
      score: 90,
      officialFactsReady: true,
      competingCategories: ["vvs"],
      conflictingTextCategories: [],
    });

    const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    expect(result).toMatchObject({
      policyVersion: "test-policy-v2",
      selected: 1,
      evaluated: 1,
      kept: 0,
      movedToReview: 1,
      deferred: 0,
      errors: 0,
      remaining: 0,
    });

    const selection = sqlCalls.find((call) => call.query.includes("select profile.id::text"));
    expect(selection?.query).toContain("profile.publication_status in ('published', 'ready')");
    expect(selection?.query).toContain("categoryConfidencePolicyLastAttemptAt");
    expect(selection?.query).toContain("when 'published' then 0 else 1");
    expect(selection?.query).toContain("categoryConfidencePolicy,version");
    expect(selection?.query).toContain("count(*) over()::int as policy_backlog_count");
    expect(selection?.values).toContain("test-policy-v2");
    expect(
      selection?.query.indexOf("categoryConfidencePolicyLastAttemptAt"),
    ).toBeLessThan(selection?.query.indexOf("when 'published' then 0 else 1") ?? 0);

    const attempt = sqlCalls.find((call) => (
      call.query.includes("update company_directory_scb_enrichment scb")
      && call.query.includes("categoryConfidencePolicyLastAttemptAt")
    ));
    expect(attempt?.values).toContain(PROFILE_TOKEN);
    expect(attempt?.values).toContain(FACTS_TOKEN);
    expect(attempt?.values).toContain(FACTS_HASH);
    expect(attempt?.values).toContain(SCB_HASH);

    const move = sqlCalls.find((call) => call.query.includes("with moved_profile as"));
    expect(move?.query).toContain("set publication_status = 'review'");
    expect(move?.query).toContain("update company_directory_scb_enrichment scb");
    expect(move?.query).toContain("jsonb_build_object");
    expect(move?.query).toContain("resultingProfileUpdatedToken");
    expect(move?.query).toContain("'decision', 'review'");
    expect(move?.values).toContain("ready");
    expect(move?.values).toContain("test-policy-v2");
    expect(move?.values).toContain(PROFILE_TOKEN);
    expect(move?.values).toContain(FACTS_TOKEN);
    expect(move?.values).toContain(FACTS_HASH);
    expect(move?.values).toContain(SCB_HASH);

    const standalonePolicyMarker = sqlCalls.find((call) => (
      call.query.startsWith("update company_directory_scb_enrichment scb")
      && call.query.includes("jsonb_build_object")
    ));
    expect(standalonePolicyMarker).toBeUndefined();
  });

  it("records the current policy version and keeps a safe Published profile public", async () => {
    configure({ status: "published" });

    const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      evaluated: 1,
      kept: 1,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
    });
    expect(sqlCalls.some((call) => call.query.includes("set publication_status = 'review'"))).toBe(false);
    const policyMarker = sqlCalls.find((call) => (
      call.query.startsWith("update company_directory_scb_enrichment scb")
      && call.query.includes("jsonb_build_object")
    ));
    expect(policyMarker?.values).toContain("test-policy-v2");
  });

  it("fails closed on a concurrent evidence change before evaluating a stale decision", async () => {
    configure({ status: "ready", attemptRows: [] });
    mocks.assessConfidence.mockReturnValue({
      score: 90,
      officialFactsReady: true,
      competingCategories: [],
      conflictingTextCategories: [],
    });

    const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      evaluated: 0,
      kept: 0,
      movedToReview: 0,
      deferred: 1,
      errors: 0,
    });
    expect(mocks.assessConfidence).not.toHaveBeenCalled();
    expect(sqlCalls.some((call) => call.query.includes("set publication_status = 'review'"))).toBe(false);
  });

  it("keeps a failed atomic demotion selectable for a later policy sweep", async () => {
    configure({ status: "ready", moveRows: [], backlog: 1 });
    mocks.assessConfidence.mockReturnValue({
      score: 90,
      officialFactsReady: true,
      competingCategories: ["vvs"],
      conflictingTextCategories: [],
    });

    const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      evaluated: 0,
      movedToReview: 0,
      deferred: 1,
      errors: 0,
      remaining: 1,
    });
    const move = sqlCalls.find((call) => call.query.includes("with moved_profile as"));
    expect(move?.query).toContain("jsonb_build_object");
    expect(move?.values).toContain("test-policy-v2");
    expect(sqlCalls.some((call) => (
      call.query.startsWith("update company_directory_scb_enrichment scb")
      && call.query.includes("jsonb_build_object")
    ))).toBe(false);
  });

  it("keeps a rejecting atomic demotion selectable instead of writing a separate policy marker", async () => {
    configure({ status: "published", moveError: new Error("write conflict"), backlog: 1 });
    mocks.assessConfidence.mockReturnValue({
      score: 90,
      officialFactsReady: true,
      competingCategories: [],
      conflictingTextCategories: ["maleri"],
    });

    const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      evaluated: 0,
      movedToReview: 0,
      errors: 1,
      remaining: 1,
    });
    expect(result.errorSummary).toContain("write conflict");
    expect(sqlCalls.some((call) => (
      call.query.startsWith("update company_directory_scb_enrichment scb")
      && call.query.includes("jsonb_build_object")
    ))).toBe(false);
  });

  it("uses attempt-age ordering so a deferred row does not permanently own the batch head", async () => {
    configure({ backlog: 1 });

    await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    const selection = sqlCalls.find((call) => call.query.includes("select profile.id::text"));
    expect(selection?.query).toContain("categoryConfidencePolicyLastAttemptAt");
    expect(selection?.query).toContain("'-infinity'::timestamptz");
    expect(selection?.query).toContain("regexp_replace(profile.organization_number");
  });

  it("reserves deadline headroom before starting any policy SQL", async () => {
    configure();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      const result = await revalidateCompanyDirectoryCategoryPolicyBatch(10, {
        deadlineAt: 1_010_000,
      });

      expect(result).toMatchObject({
        selected: 0,
        evaluated: 0,
        movedToReview: 0,
        deferred: 10,
        errors: 0,
        remaining: null,
      });
      expect(mocks.getSql).not.toHaveBeenCalled();
      expect(mocks.assessConfidence).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("defers remaining candidates when deadline is reached mid-batch", async () => {
    const row1 = { ...candidate(), id: "11111111-1111-4111-8111-111111111111", organization_number: "5563115701" };
    const row2 = { ...candidate(), id: "22222222-2222-4222-8222-222222222222", organization_number: "5563115702" };
    let candidateReads = 0;
    let assessments = 0;

    responder = async (query) => {
      if (query.includes("select profile.id::text") && query.includes("categoryConfidencePolicy")) {
        candidateReads += 1;
        return candidateReads === 1 ? [row1, row2] : [];
      }
      if (
        query.includes("update company_directory_scb_enrichment scb")
        && query.includes("categoryConfidencePolicyLastAttemptAt")
      ) {
        return [{ profile_id: query.includes(row1.id) ? row1.id : row2.id }];
      }
      if (query.includes("update company_directory_scb_enrichment scb")) {
        return [{ profile_id: query.includes(row1.id) ? row1.id : row2.id }];
      }
      throw new Error(`Unexpected SQL: ${query}`);
    };

    mocks.assessConfidence.mockImplementation(() => {
      assessments += 1;
      return {
        score: 95,
        officialFactsReady: true,
        competingCategories: [],
        conflictingTextCategories: [],
      };
    });

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1_000_000);
    nowSpy.mockReturnValueOnce(1_030_000);

    try {
      const result = await revalidateCompanyDirectoryCategoryPolicyBatch(2, {
        deadlineAt: 1_050_000,
      });

      expect(result).toMatchObject({
        selected: 2,
        evaluated: 1,
        kept: 1,
        movedToReview: 0,
        deferred: 1,
        errors: 0,
        remaining: 1,
      });
      expect(assessments).toBe(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("uses only fresh bound Official Facts and SCB evidence for the policy sweep", async () => {
    configure();

    await revalidateCompanyDirectoryCategoryPolicyBatch(10);

    const selection = sqlCalls.find((call) => call.query.includes("select profile.id::text"));
    expect(selection?.query).toContain("facts.last_synced_at >= profile.last_synced_at");
    expect(selection?.query).toContain("scb.last_synced_at >= now() - interval '7 days'");
    expect(selection?.query).toContain("comparisonSnapshot,profileUpdatedToken");
    expect(selection?.query).toContain("comparisonSnapshot,officialFactsLastSyncedToken");
  });
});
