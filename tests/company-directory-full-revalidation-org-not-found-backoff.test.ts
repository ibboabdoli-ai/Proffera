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

import { BolagsverketOrganizationNotFoundError } from "../src/lib/company-directory-official-facts-errors";
import { revalidateAllCompanyDirectoryBatch } from "../src/lib/company-directory-full-revalidation";

type SqlCall = { query: string; values: unknown[] };
type SqlResponder = (query: string, values: unknown[]) => Promise<unknown[]> | unknown[];

const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "06316ff1-f162-4c26-b997-cb7aa2515b95";
const ORGANIZATION_NUMBER = "5592643778";
const BACKOFF_PREFIX = "full_revalidation:official_facts:organisation_not_found";

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
  mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true });
  mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
});

describe("full Directory deterministic Official Facts retry backoff", () => {
  it("backs off ORGANISATION_FINNS_EJ for an already hard-blocked Review profile without calling SCB", async () => {
    responder = async (query, values) => {
      if (query.includes("with blocked as (")) return [];
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) {
        return [{ id: RUN_ID, cursor_value: "" }];
      }
      if (query.includes("with eligible as (")) {
        return [{
          id: PROFILE_ID,
          organization_number: ORGANIZATION_NUMBER,
          display_name: "Kleen hem i Stockholm AB",
          publication_status: "review",
          normalized_organization_number: ORGANIZATION_NUMBER,
          status_rank: 2,
          known_hard_official_facts_block: true,
        }];
      }
      if (
        query.includes("update company_directory_discovery_queue")
        && values.some((value) => String(value).startsWith(BACKOFF_PREFIX))
      ) {
        return [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }];
      }
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in deterministic Official Facts backoff test: ${query}`);
    };

    mocks.enrichOfficialFacts.mockRejectedValue(new BolagsverketOrganizationNotFoundError(
      "ORGANISATION_FINNS_EJ",
    ));

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result).toMatchObject({
      selected: 1,
      refreshed: 0,
      kept: 1,
      movedToReview: 0,
      deferred: 1,
      errors: 0,
      errorSummary: "",
      remaining: 0,
    });
    expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(1);
    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(mocks.assessConfidence).not.toHaveBeenCalled();

    const backoff = sqlCalls.find((call) => call.query.includes("update company_directory_discovery_queue"));
    expect(backoff).toBeDefined();
    expect(backoff?.query).toContain("state = 'review'");
    expect(backoff?.query).toContain("next_attempt_at");
    expect(backoff?.values).toContain(7);
    expect(backoff?.values).toContain(PROFILE_ID);
    expect(backoff?.values.some((value) => String(value).startsWith(`${BACKOFF_PREFIX}:`))).toBe(true);
  });

  it("keeps transient Official Facts failures as errors instead of quarantining them", async () => {
    responder = async (query) => {
      if (query.includes("with blocked as (")) return [];
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) {
        return [{ id: RUN_ID, cursor_value: "" }];
      }
      if (query.includes("with eligible as (")) {
        return [{
          id: PROFILE_ID,
          organization_number: ORGANIZATION_NUMBER,
          display_name: "Kleen hem i Stockholm AB",
          publication_status: "review",
          normalized_organization_number: ORGANIZATION_NUMBER,
          status_rank: 2,
          known_hard_official_facts_block: true,
        }];
      }
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in transient Official Facts test: ${query}`);
    };

    mocks.enrichOfficialFacts.mockRejectedValue(new Error("Official facts lookup timed out"));

    const result = await revalidateAllCompanyDirectoryBatch(10);

    expect(result.errors).toBe(1);
    expect(result.errorSummary).toContain("Official facts lookup timed out");
    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(sqlCalls.some((call) => call.query.includes("update company_directory_discovery_queue"))).toBe(false);
  });

  it("matches the backoff marker namespace literally in candidate and backlog queries", async () => {
    responder = async (query) => {
      if (query.includes("with blocked as (")) return [];
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) {
        return [{ id: RUN_ID, cursor_value: "" }];
      }
      if (query.includes("with eligible as (")) return [];
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in suppression contract test: ${query}`);
    };

    const result = await revalidateAllCompanyDirectoryBatch(10);
    expect(result).toMatchObject({ selected: 0, errors: 0, remaining: 0 });

    const selection = sqlCalls.find((call) => call.query.includes("with eligible as ("));
    const backlog = sqlCalls.find((call) => call.query.includes("select count(*)::int as count"));
    for (const call of [selection, backlog]) {
      expect(call?.query).toContain("starts_with(queue.last_error");
      expect(call?.query).not.toContain("queue.last_error like");
      expect(call?.query).toContain("next_attempt_at > now()");
      expect(call?.query).toContain("queue.state = 'review'");
      expect(call?.values).toContain(`${BACKOFF_PREFIX}:`);
      expect(call?.values.some((value) => String(value).includes("%"))).toBe(false);
    }
  });
});
