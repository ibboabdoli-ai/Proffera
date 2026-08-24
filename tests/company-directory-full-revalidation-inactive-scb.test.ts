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

const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

let sqlCalls: SqlCall[] = [];
let sql: ReturnType<typeof vi.fn>;

function normalizeQuery(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

beforeEach(() => {
  sqlCalls = [];
  sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = normalizeQuery(strings);
    sqlCalls.push({ query, values });

    if (query.includes("started_at < now() - interval '10 minutes'")) return [];
    if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID, cursor_value: "" }];
    if (query.includes("with eligible as")) {
      return [{
        id: PROFILE_ID,
        organization_number: "5569461436",
        display_name: "Inactive Example AB",
        publication_status: "inactive",
        normalized_organization_number: "5569461436",
        status_rank: 3,
      }];
    }
    if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
    if (query.includes("select count(*)::int as count")) return [{ count: 0 }];

    throw new Error(`Unexpected SQL in inactive SCB bypass test: ${query}`);
  });

  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getSql.mockReturnValue(sql);
  mocks.createScbTransport.mockReturnValue({
    fetchCompany: vi.fn(),
    fetchWorkplaces: vi.fn(),
  });
  mocks.enrichOfficialFacts.mockResolvedValue({
    profileId: PROFILE_ID,
    organizationNumber: "5569461436",
    reusedVerifiedDetail: false,
  });
});

describe("full Directory revalidation for inactive profiles", () => {
  it("refreshes Official Facts without calling the active-only SCB lookup", async () => {
    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      skipped: false,
      selected: 1,
      refreshed: 1,
      kept: 1,
      movedToReview: 0,
      recoveredToReady: 0,
      deferred: 0,
      errors: 0,
      remaining: 0,
    });
    expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
    expect(mocks.enrichOfficialFacts).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(mocks.assessConfidence).not.toHaveBeenCalled();

    const selection = sqlCalls.find((call) => call.query.includes("with eligible as"));
    const backlog = sqlCalls.find((call) => call.query.includes("select count(*)::int as count"));
    for (const call of [selection, backlog]) {
      expect(call?.query).toContain("profile.publication_status <> 'inactive'");
      expect(call?.query.indexOf("profile.publication_status <> 'inactive'") ?? -1)
        .toBeLessThan(call?.query.indexOf("scb.profile_id is null") ?? -1);
    }
  });
});
