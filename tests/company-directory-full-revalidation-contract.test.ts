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
const PROFILE_TOKEN = "2026-08-20 04:00:00.000000+00";
const FACTS_TOKEN = "2026-08-20 04:01:00.000000+00";
const FACTS_HASH = "facts-hash";
const SCB_HASH = "scb-hash";

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

function candidate(status = "ready") {
  return {
    id: PROFILE_ID,
    organization_number: "5563115707",
    display_name: "Exempel El AB",
    publication_status: status,
  };
}

function evaluation(status = "ready", overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    country_code: "SE",
    organization_kind: "juridical_person",
    publication_status: status,
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
    registered_names: [{ name: "Exempel El AB", specialBusinessDescription: "" }],
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
    ...overrides,
  };
}

function configureWorker(input: {
  status?: string;
  evaluation?: Record<string, unknown>;
  moveRows?: unknown[];
  backlog?: number;
} = {}) {
  const status = input.status ?? "ready";
  const fresh = input.evaluation ?? evaluation(status);
  const moveRows = input.moveRows ?? [{ id: PROFILE_ID }];
  const backlog = input.backlog ?? 0;

  responder = async (query) => {
    if (query.includes("started_at < now() - interval '10 minutes'")) return [];
    if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID }];
    if (query.includes("select profile.id::text, profile.organization_number, profile.display_name, profile.publication_status")) {
      return [candidate(status)];
    }
    if (query.includes("profile.category_slug") && query.includes("scb_snapshot_fresh")) return [fresh];
    if (query.includes("update company_directory_profiles profile")) return moveRows;
    if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
    if (query.includes("select count(*)::int as count")) return [{ count: backlog }];
    throw new Error(`Unexpected SQL in full revalidation test: ${query}`);
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
    organizationNumber: "5563115707",
    reusedVerifiedDetail: false,
  });
  mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
  mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
});

describe("full Company Directory revalidation", () => {
  it("fails closed when the SCB certificate is not configured", async () => {
    mocks.createScbTransport.mockReturnValue(null);
    responder = async (query) => {
      if (query.includes("select count(*)::int as count")) return [{ count: 1787 }];
      throw new Error(`Unexpected SQL in missing-SCB test: ${query}`);
    };

    await expect(revalidateAllCompanyDirectoryBatch(10)).resolves.toMatchObject({
      skipped: true,
      reason: "scb_access_not_configured",
      selected: 0,
      remaining: 1787,
    });
    expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.enrichScb).not.toHaveBeenCalled();
  });

  it("refreshes a low-confidence Ready profile and moves it to Review", async () => {
    configureWorker({ status: "ready" });
    mocks.assessConfidence.mockReturnValue({ score: 90, officialFactsReady: true, reasons: [] });

    const order: string[] = [];
    mocks.enrichOfficialFacts.mockImplementation(async () => {
      order.push("official-facts");
      return { profileId: PROFILE_ID, organizationNumber: "5563115707", reusedVerifiedDetail: false };
    });
    mocks.enrichScb.mockImplementation(async () => {
      order.push("scb");
      return { status: "saved", saved: true, conflicts: [] };
    });

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      refreshed: 1,
      movedToReview: 1,
      errors: 0,
    });
    expect(order).toEqual(["official-facts", "scb", "scb"]);
    const selection = sqlCalls.find((call) => call.query.includes("profile.publication_status"));
    expect(selection?.query).toContain("when 'published' then 0");
    expect(selection?.query).toContain("when 'ready' then 1");
    expect(selection?.query).toContain("scb.last_synced_at < now() - interval '7 days'");
    const move = sqlCalls.find((call) => call.query.includes("update company_directory_profiles profile"));
    expect(move?.values).toContain("ready");
    expect(move?.values).toContain(PROFILE_TOKEN);
    expect(move?.values).toContain(FACTS_TOKEN);
    expect(move?.values).toContain(FACTS_HASH);
    expect(move?.values).toContain(SCB_HASH);
  });

  it("refreshes Review profiles without automatically publishing them", async () => {
    configureWorker({ status: "review", evaluation: evaluation("review") });

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      refreshed: 1,
      kept: 1,
      movedToReview: 0,
      errors: 0,
    });
    expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
    expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
    expect(sqlCalls.some((call) => call.query.includes("update company_directory_profiles profile"))).toBe(false);
  });

  it("caps an oversized automatic batch at twelve profiles", async () => {
    responder = async (query, values) => {
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID }];
      if (query.includes("select profile.id::text, profile.organization_number, profile.display_name, profile.publication_status")) {
        expect(values.at(-1)).toBe(12);
        return [];
      }
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in batch-cap test: ${query}`);
    };

    await expect(revalidateAllCompanyDirectoryBatch(99)).resolves.toMatchObject({
      selected: 0,
      remaining: 0,
      errors: 0,
    });
  });
});
