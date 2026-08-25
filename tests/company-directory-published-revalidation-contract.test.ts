import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import vercelConfig from "../vercel.json";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  assessConfidence: vi.fn(),
  enrichOfficialFacts: vi.fn(),
  enrichScb: vi.fn(),
  createScbTransport: vi.fn(),
  fullRevalidate: vi.fn(),
  routeRevalidate: vi.fn(),
  readyAutoPublish: vi.fn(),
  processNewQueue: vi.fn(),
  processQueue: vi.fn(),
  syncDirectory: vi.fn(),
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

import { revalidatePublishedCompanyDirectoryBatch } from "../src/lib/company-directory-published-revalidation";

type SqlCall = { query: string; values: unknown[] };
type SqlResponder = (query: string, values: unknown[]) => Promise<unknown[]> | unknown[];

const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_TOKEN = "2026-08-19 10:00:00.123456+00";
const FACTS_TOKEN = "2026-08-19 10:01:00.654321+00";
const FACTS_HASH = "facts-hash";
const SCB_HASH = "scb-hash";

const transport = {
  fetchCompany: vi.fn(),
  fetchWorkplaces: vi.fn(),
};

let sqlCalls: SqlCall[] = [];
let sqlResponder: SqlResponder;
let sql: ReturnType<typeof vi.fn>;

function normalizeQuery(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function candidateRow() {
  return {
    id: PROFILE_ID,
    organization_number: "5563115707",
    display_name: "Exempel El AB",
  };
}

function freshEvaluation(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    country_code: "SE",
    organization_kind: "juridical_person",
    publication_status: "published",
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

function configureCandidateSql(input: {
  evaluation?: Record<string, unknown>;
  moveRows?: unknown[];
  backlog?: number;
} = {}) {
  const evaluation = input.evaluation ?? freshEvaluation();
  const moveRows = input.moveRows ?? [{ id: PROFILE_ID }];
  const backlog = input.backlog ?? 0;

  sqlResponder = async (query) => {
    if (query.includes("started_at < now() - interval '10 minutes'")) return [];
    if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID }];
    if (query.includes("select profile.id::text, profile.organization_number, profile.display_name")) {
      return [candidateRow()];
    }
    if (query.includes("profile.category_slug") && query.includes("scb_snapshot_fresh")) {
      return [evaluation];
    }
    if (query.includes("update company_directory_profiles profile")) return moveRows;
    if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
    if (query.includes("select count(*)::int as count")) return [{ count: backlog }];
    throw new Error(`Unexpected SQL in test: ${query}`);
  };
}

async function loadStandaloneRevalidationRoute() {
  vi.resetModules();
  vi.doMock("@/lib/company-directory-published-revalidation", () => ({
    revalidatePublishedCompanyDirectoryBatch: mocks.routeRevalidate,
  }));
  return await import("../src/app/api/cron/company-directory-published-revalidation/route");
}

async function loadAutomaticSyncRoute() {
  vi.resetModules();
  vi.doMock("@/lib/company-directory-full-revalidation", () => ({
    revalidateAllCompanyDirectoryBatch: mocks.fullRevalidate,
  }));
  vi.doMock("@/lib/company-directory-published-revalidation", () => ({
    revalidatePublishedCompanyDirectoryBatch: mocks.routeRevalidate,
  }));
  vi.doMock("@/lib/company-directory-ready-auto-publish", () => ({
    autoPublishReadyHighConfidenceCompanyDirectoryBatch: mocks.readyAutoPublish,
  }));
  vi.doMock("@/lib/company-directory-discovery-queue", () => ({
    processNewCompanyDirectoryDiscoveryQueueBatch: mocks.processNewQueue,
    processCompanyDirectoryDiscoveryQueue: mocks.processQueue,
  }));
  vi.doMock("@/lib/company-directory-engine", () => ({
    syncCompanyDirectory: mocks.syncDirectory,
  }));
  vi.doMock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
  return await import("../src/app/api/cron/company-directory-sync/route");
}

beforeEach(() => {
  sqlCalls = [];
  sqlResponder = async () => [];
  sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = normalizeQuery(strings);
    sqlCalls.push({ query, values });
    return await sqlResponder(query, values);
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

  delete process.env.CRON_SECRET;
  delete process.env.COMPANY_DIRECTORY_SYNC_ENABLED;
  delete process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED;
  delete process.env.COMPANY_DIRECTORY_DISCOVERY_MODE;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.COMPANY_DIRECTORY_SYNC_ENABLED;
  delete process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED;
  delete process.env.COMPANY_DIRECTORY_DISCOVERY_MODE;
});

describe("published Directory revalidation worker", () => {
  it("honors the single-run lease", async () => {
    sqlResponder = async (query) => {
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 6 }];
      throw new Error(`Unexpected SQL in lease test: ${query}`);
    };

    await expect(revalidatePublishedCompanyDirectoryBatch(2)).resolves.toMatchObject({
      skipped: true,
      reason: "already_running",
      selected: 0,
      remaining: 6,
    });
    expect(mocks.enrichOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.enrichScb).not.toHaveBeenCalled();
  });

  it("finalizes the lease immediately when candidate selection throws", async () => {
    sqlResponder = async (query) => {
      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID }];
      if (query.includes("select profile.id::text, profile.organization_number, profile.display_name")) {
        throw new Error("selection failed");
      }
      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      throw new Error(`Unexpected SQL in selection-failure test: ${query}`);
    };

    await expect(revalidatePublishedCompanyDirectoryBatch(2)).rejects.toThrow("selection failed");
    const finish = sqlCalls.find((call) => (
      call.query.includes("update company_directory_sync_runs")
      && call.query.includes("where id =")
    ));
    expect(finish?.values).toContain("failed");
    expect(finish?.values).toContain("selection failed");
    expect(finish?.values).toContain(RUN_ID);
  });

  it("refreshes Official Facts before SCB and keeps fresh 95+ evidence published", async () => {
    configureCandidateSql();
    const order: string[] = [];
    mocks.enrichOfficialFacts.mockImplementation(async () => {
      order.push("official-facts");
      return { profileId: PROFILE_ID, organizationNumber: "5563115707", reusedVerifiedDetail: false };
    });
    mocks.enrichScb.mockImplementation(async () => {
      order.push("scb");
      return { status: "saved", saved: true, conflicts: [] };
    });

    const result = await revalidatePublishedCompanyDirectoryBatch(99);

    expect(order).toEqual(["official-facts", "scb"]);
    expect(result).toMatchObject({
      selected: 1,
      revalidated: 1,
      keptPublished: 1,
      movedToReview: 0,
      errors: 0,
    });
    const selection = sqlCalls.find((call) => (
      call.query.includes("select profile.id::text, profile.organization_number, profile.display_name")
    ));
    expect(selection?.query).toContain("profile.publication_status = 'published'");
    expect(selection?.query).toContain("profile.claimed_workspace_id is null");
    expect(selection?.values.at(-1)).toBe(3);
  });

  it("moves fresh evidence below 95 to Review with exact snapshot guards", async () => {
    configureCandidateSql();
    mocks.assessConfidence.mockReturnValue({ score: 90, officialFactsReady: true, reasons: [] });

    const result = await revalidatePublishedCompanyDirectoryBatch(2);

    expect(result).toMatchObject({
      revalidated: 1,
      movedToReview: 1,
      errors: 0,
    });
    const reviewUpdate = sqlCalls.find((call) => call.query.includes("update company_directory_profiles profile"));
    expect(reviewUpdate?.values).toContain(PROFILE_TOKEN);
    expect(reviewUpdate?.values).toContain(FACTS_TOKEN);
    expect(reviewUpdate?.values).toContain(FACTS_HASH);
    expect(reviewUpdate?.values).toContain(SCB_HASH);
  });

  it("defers instead of demoting when the optimistic-concurrency guard loses the race", async () => {
    configureCandidateSql({ moveRows: [] });
    mocks.assessConfidence.mockReturnValue({ score: 90, officialFactsReady: true, reasons: [] });

    await expect(revalidatePublishedCompanyDirectoryBatch(2)).resolves.toMatchObject({
      movedToReview: 0,
      deferred: 1,
      errors: 0,
    });
  });
});

describe("published Directory revalidation scheduling", () => {
  it("keeps the standalone endpoint protected by CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-secret";
    process.env.COMPANY_DIRECTORY_SYNC_ENABLED = "true";
    const { GET } = await loadStandaloneRevalidationRoute();

    const response = await GET(new Request("https://example.test/api/cron/company-directory-published-revalidation"));

    expect(response.status).toBe(401);
    expect(mocks.routeRevalidate).not.toHaveBeenCalled();
  });

  it("keeps only published-profile revalidation in the automatic Operations queue", async () => {
    process.env.CRON_SECRET = "test-secret";
    process.env.COMPANY_DIRECTORY_SYNC_ENABLED = "true";
    process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED = "true";
    process.env.COMPANY_DIRECTORY_DISCOVERY_MODE = "automatic";

    const historySql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(historySql);
    mocks.readyAutoPublish.mockResolvedValue({ scanned: 20, published: 0, errors: 0, errorSummary: "" });
    mocks.processNewQueue.mockResolvedValue({
      claimed: 0,
      processed: 0,
      published: 0,
      blocked: 0,
      errors: 0,
      errorSummary: "",
    });
    mocks.processQueue.mockResolvedValue({
      claimed: 5,
      processed: 5,
      published: 0,
      blocked: 0,
      errors: 0,
      errorSummary: "",
    });
    mocks.fullRevalidate.mockResolvedValue({
      skipped: false,
      reason: "",
      selected: 3,
      refreshed: 3,
      kept: 3,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: 1500,
    });
    mocks.routeRevalidate.mockResolvedValue({
      skipped: false,
      reason: "",
      selected: 2,
      revalidated: 2,
      keptPublished: 1,
      movedToReview: 1,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      reviewSummary: "",
      remaining: 471,
    });

    const startedAtMs = 1_000_000;
    const expectedDeadlineAt = startedAtMs + 60_000 - 5_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(startedAtMs);

    try {
      const { GET } = await loadAutomaticSyncRoute();
      const response = await GET(new Request(
        "https://example.test/api/cron/company-directory-sync",
        { headers: { authorization: "Bearer test-secret" } },
      ));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mocks.fullRevalidate).not.toHaveBeenCalled();
      expect(mocks.routeRevalidate).toHaveBeenCalledTimes(1);
      const publishedOptions = mocks.routeRevalidate.mock.calls[0]?.[1];
      expect(mocks.routeRevalidate.mock.calls[0]?.[0]).toBe(2);
      expect(publishedOptions).toEqual({ deadlineAt: expectedDeadlineAt });
      expect(body).toMatchObject({
        ok: true,
        mode: "automatic_queue",
        publishedRevalidation: {
          selected: 2,
          revalidated: 2,
          keptPublished: 1,
          movedToReview: 1,
          remaining: 471,
        },
      });
      expect(body).not.toHaveProperty("fullRevalidation");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("does not register a frequent Vercel cron for revalidation", () => {
    expect(vercelConfig.crons).toEqual([
      {
        path: "/api/cron/company-directory-official-facts",
        schedule: "17 2 * * *",
      },
    ]);
  });
});
