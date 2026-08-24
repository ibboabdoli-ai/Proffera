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

type SqlCall = { query: string; values: unknown[] };
type SqlResponder = (query: string, values: unknown[]) => Promise<unknown[]> | unknown[];

const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_NUMBER = "5594022609";
const PROFILE_TOKEN = "2026-08-24 18:35:00.000000+00";
const FACTS_TOKEN = "2026-08-24 18:35:02.000000+00";
const FACTS_HASH = "facts-hash";
const DETERMINISTIC_SCB_ERROR = "SCB company registry response must contain exactly one matching company";

const transport = {
  fetchCompany: vi.fn(),
  fetchWorkplaces: vi.fn(),
};

let sqlCalls: SqlCall[] = [];
let responder: SqlResponder;
let sql: ReturnType<typeof vi.fn>;

function normalizeQuery(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function candidate(status = "ready", knownHardOfficialFactsBlock = false) {
  return {
    id: PROFILE_ID,
    organization_number: ORGANIZATION_NUMBER,
    display_name: "Example AB",
    publication_status: status,
    normalized_organization_number: ORGANIZATION_NUMBER,
    known_hard_official_facts_block: knownHardOfficialFactsBlock,
  };
}

function evaluation(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    country_code: "SE",
    organization_kind: "juridical_person",
    publication_status: "ready",
    category_slug: "bygg",
    primary_sni_code: "43.320",
    legal_name: "Example AB",
    display_name: "Example AB",
    activity_description: "Byggverksamhet",
    is_active: true,
    privacy_blocked: false,
    auto_public_eligible: true,
    claimed_workspace_id: null,
    profile_updated_token: PROFILE_TOKEN,
    registered_names: [{ name: "Example AB" }],
    sni_codes: [{ code: "43.320" }],
    deregistration_date: null,
    advertising_blocked: false,
    ongoing_procedures: [],
    facts_last_synced_token: FACTS_TOKEN,
    facts_source_payload_hash: FACTS_HASH,
    scb_source_payload_hash: "",
    scb_conflict_count: 0,
    official_facts_fresh: true,
    scb_snapshot_fresh: false,
    ...overrides,
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

  for (const mock of Object.values(mocks)) mock.mockReset();
  transport.fetchCompany.mockReset();
  transport.fetchWorkplaces.mockReset();

  mocks.getSql.mockReturnValue(sql);
  mocks.createScbTransport.mockReturnValue(transport);
  mocks.enrichOfficialFacts.mockResolvedValue({
    profileId: PROFILE_ID,
    organizationNumber: ORGANIZATION_NUMBER,
    reusedVerifiedDetail: false,
  });
  mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
  mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
});

describe("full Directory revalidation hard-block and deterministic SCB handling", () => {
  it("moves a Ready profile with persisted bankruptcy/fusion evidence to Review before SCB configuration is needed", async () => {
    responder = async (query) => {
      if (query.includes("with blocked as (")) return [{ id: PROFILE_ID }];
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID, cursor_value: "" }];
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in persisted hard-block test: ${query}`);
    };

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      movedToReview: 1,
      errors: 0,
      deferred: 0,
      remaining: 0,
    });
    expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(mocks.assessConfidence).not.toHaveBeenCalled();
  });

  it("still demotes a persisted hard block when SCB access is unavailable", async () => {
    responder = async (query) => {
      if (query.includes("with blocked as (")) return [{ id: PROFILE_ID }];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in SCB-unavailable hard-block test: ${query}`);
    };
    mocks.createScbTransport.mockReturnValue(null);

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      skipped: true,
      reason: "scb_access_not_configured",
      selected: 1,
      movedToReview: 1,
      errors: 0,
      remaining: 0,
    });
    expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.enrichScb).not.toHaveBeenCalled();
  });

  it("moves a Ready profile to Review and records a fail-closed retry marker after deterministic SCB no-match", async () => {
    const fresh = evaluation();
    let evaluationReads = 0;

    responder = async (query) => {
      if (query.includes("with blocked as (")) return [];
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID, cursor_value: "" }];
      if (query.includes("with eligible as (")) return [candidate("ready")];
      if (query.includes("profile.category_slug") && query.includes("scb_snapshot_fresh")) {
        evaluationReads += 1;
        return [fresh];
      }
      if (
        query.includes("update company_directory_profiles profile")
        && !query.includes("facts.deregistration_date is not null")
        && !query.includes("company_directory_scb_enrichment scb")
      ) return [{ id: PROFILE_ID }];
      if (query.includes("insert into company_directory_scb_enrichment") && query.includes("revalidationFailure")) {
        return [{ profile_id: PROFILE_ID }];
      }
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in deterministic SCB test: ${query}`);
    };

    mocks.enrichScb.mockRejectedValue(new Error(DETERMINISTIC_SCB_ERROR));

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      movedToReview: 1,
      errors: 0,
      errorSummary: "",
      remaining: 0,
    });
    expect(evaluationReads).toBe(1);
    expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
    expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
    expect(mocks.assessConfidence).not.toHaveBeenCalled();

    const marker = sqlCalls.find(
      (call) => call.query.includes("insert into company_directory_scb_enrichment")
        && call.query.includes("revalidationFailure"),
    );
    expect(marker?.values).toContain("company_match_count");
    expect(marker?.query).toContain("source_payload_hash");
    expect(marker?.query).toContain("on conflict (profile_id) do update");
  });

  it("suppresses blocked Review rows between bounded Official Facts rechecks and current SCB failures", async () => {
    responder = async (query) => {
      if (query.includes("with blocked as (")) return [];
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID, cursor_value: "" }];
      if (query.includes("with eligible as (")) return [];
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in selection suppression test: ${query}`);
    };

    const result = await revalidateAllCompanyDirectoryBatch(10);
    expect(result).toMatchObject({ selected: 0, remaining: 0, errors: 0 });

    const selection = sqlCalls.find((call) => call.query.includes("with eligible as ("));
    const backlog = sqlCalls.find((call) => call.query.includes("select count(*)::int as count"));
    for (const call of [selection, backlog]) {
      expect(call?.query).toContain("profile.publication_status = 'review'");
      expect(call?.query).toContain("ongoing_procedures");
      expect(call?.query).toContain("greatest(facts.last_synced_at, profile.updated_at)");
      expect(call?.query).toContain("revalidationFailure");
      expect(call?.query).toContain("profileUpdatedToken");
      expect(call?.query).toContain("officialFactsLastSyncedToken");
      expect(call?.query).toContain("interval '24 hours'");
    }
  });
});
