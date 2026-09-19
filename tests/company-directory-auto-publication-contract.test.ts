import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  enrichScb: vi.fn(),
  assessConfidence: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.enrichScb,
}));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));

import { publishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";
import { autoPublishReadyHighConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-ready-auto-publish";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_UPDATED_TOKEN = "2026-08-19 10:00:00.123456+00";
const FACTS_LAST_SYNCED_TOKEN = "2026-08-19 09:59:00.654321+00";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function safeScbWorkplace() {
  return {
    cfarNumber: "12345678",
    municipality: "Stockholm",
    visitingAddress: {
      addressLine: "Arbetsplatsgatan 2",
      postalCode: "11122",
      city: "Stockholm",
    },
  };
}

function safePublicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    public_slug: "exempel-el",
    display_name: "Exempel El AB",
    legal_name: "Exempel El AB",
    category_slug: "elektriker",
    primary_sni_code: "43210",
    activity_description: "Elinstallationer",
    address_line1: "Registrerad gata 1",
    postal_code: "15100",
    city: "Södertälje",
    municipality: "Södertälje",
    publication_status: "ready",
    is_active: true,
    privacy_blocked: false,
    auto_public_eligible: true,
    claimed_workspace_id: null,
    profile_updated_token: PROFILE_UPDATED_TOKEN,
    facts_profile_id: PROFILE_ID,
    registered_names: ["Exempel El AB"],
    sni_codes: [{ code: "43.210", label: "Elinstallationer" }],
    deregistration_date: null,
    advertising_blocked: false,
    ongoing_procedures: [],
    facts_last_synced_token: FACTS_LAST_SYNCED_TOKEN,
    facts_source_payload_hash: "official-facts-hash",
    official_facts_fresh: true,
    scb_snapshot_fresh: false,
    ...overrides,
  };
}

function refreshedScbRow() {
  return {
    address_line1: "Registrerad gata 1",
    postal_code: "15100",
    city: "Södertälje",
    municipality: "Södertälje",
    scb_workplaces: [safeScbWorkplace()],
    scb_source_payload_hash: "scb-hash",
    scb_conflict_count: 0,
    scb_snapshot_fresh: true,
  };
}

function mockPublicationSql(row: Record<string, unknown>, finalRows: unknown[] = []) {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = Array.from(strings).join("?");
    if (query.includes("from company_directory_profiles p") && query.includes("official_facts_fresh")) {
      return [row];
    }
    if (query.includes("scb.workplaces as scb_workplaces") && !query.includes("official_facts_fresh")) {
      return [refreshedScbRow()];
    }
    if (query.includes("update company_directory_profiles p")) {
      return finalRows;
    }
    return [];
  });
}

function executedQuery(call: unknown[] | undefined) {
  const strings = call?.[0] as TemplateStringsArray | undefined;
  return strings ? Array.from(strings).join("?") : "";
}

function findSqlCall(sql: ReturnType<typeof vi.fn>, fragment: string) {
  return sql.mock.calls.find((call) => executedQuery(call).includes(fragment));
}

describe("safe company directory auto publication contract", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.enrichScb.mockReset();
    mocks.assessConfidence.mockReset();
    mocks.assessConfidence.mockReturnValue({
      score: 100,
      officialFactsReady: true,
    });
    mocks.enrichScb.mockResolvedValue({
      status: "saved",
      saved: true,
      conflicts: [],
    });
  });

  it("never publishes from candidate upsert alone", () => {
    const engine = source("src/lib/company-directory-engine.ts");

    expect(engine).toContain("const desiredStatus = assessment.publicationStatus;");
    expect(engine).not.toContain("function autoPublishEnabled");
    expect(engine).not.toContain("COMPANY_DIRECTORY_AUTO_PUBLISH");
  });

  it("publishes automatic queue work only after successful Official Facts enrichment", () => {
    const queue = source("src/lib/company-directory-discovery-queue.ts");
    const start = queue.indexOf("export async function processCompanyDirectoryDiscoveryQueue");
    const end = queue.indexOf("async function requeueControlledBatchPilotItem", start);
    const automaticQueue = queue.slice(start, end);

    const upsert = automaticQueue.indexOf("await upsertCompanyDirectoryCandidate");
    const enrich = automaticQueue.indexOf("await enrichCompanyDirectoryOfficialFactsForProfile");
    const publish = automaticQueue.indexOf("await autoPublishCompanyDirectoryProfileIfSafe");
    const complete = automaticQueue.indexOf("await completeQueueItem");

    expect(upsert).toBeGreaterThanOrEqual(0);
    expect(enrich).toBeGreaterThan(upsert);
    expect(publish).toBeGreaterThan(enrich);
    expect(complete).toBeGreaterThan(publish);
    expect(automaticQueue).toContain('autoPublication.code !== "unsafe"');
    expect(automaticQueue).toContain('autoPublication.code !== "low_confidence"');
    expect(automaticQueue).toContain("Automatic publication requires retry");
  });

  it("uses one fail-closed safety gate for manual and automatic publication", () => {
    const publication = source("src/lib/company-directory-publication.ts");
    const admin = source("src/lib/company-directory-publication-admin.ts");

    expect(admin).toContain("publishCompanyDirectoryProfileIfSafe(profileId)");
    expect(publication).toContain("COMPANY_DIRECTORY_AUTO_PUBLISH");
    expect(publication).toContain('text(row.publication_status) !== "ready"');
    expect(publication).toContain("!Boolean(row.is_active)");
    expect(publication).toContain("Boolean(row.privacy_blocked)");
    expect(publication).toContain("!Boolean(row.auto_public_eligible)");
    expect(publication).toContain("Boolean(row.claimed_workspace_id)");
    expect(publication).toContain("!confidence.officialFactsReady || !officialFactsFresh");
    expect(publication).toContain("confidence.score < 95");
    expect(publication).toContain("Boolean(row.deregistration_date)");
    expect(publication).toContain("Boolean(row.advertising_blocked)");
    expect(publication).toContain("jsonArray(row.ongoing_procedures).length > 0");
    expect(publication).toContain("queue.state = 'failed'");
    expect(publication).toContain('scb.status !== "saved"');
  });

  it.each([
    ["non-ready profile", { publication_status: "review" }, 100, true, "not_ready"],
    ["unavailable Official Facts", {}, 100, false, "not_ready"],
    ["stale Official Facts", { official_facts_fresh: false }, 100, true, "not_ready"],
    ["privacy-blocked profile", { privacy_blocked: true }, 100, true, "unsafe"],
    ["low-confidence profile", {}, 90, true, "low_confidence"],
  ])("does not call SCB when preflight rejects a %s", async (_label, overrides, score, officialFactsReady, expectedCode) => {
    const sql = mockPublicationSql(safePublicationRow(overrides));
    mocks.getSql.mockReturnValue(sql);
    mocks.assessConfidence.mockReturnValue({
      score,
      officialFactsReady,
    });

    const result = await publishCompanyDirectoryProfileIfSafe(PROFILE_ID);

    expect(result).toEqual({ ok: false, code: expectedCode });
    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it.each(["disabled", "awaiting_access", "ineligible"] as const)(
    "fails closed when SCB enrichment is %s",
    async (status) => {
      const sql = mockPublicationSql(safePublicationRow());
      mocks.getSql.mockReturnValue(sql);
      mocks.enrichScb.mockResolvedValue({ status, saved: false, conflicts: [] });

      await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
        ok: false,
        code: "not_ready",
      });
      expect(sql).toHaveBeenCalledTimes(1);
    },
  );

  it("blocks publication immediately when live SCB enrichment reports a conflict", async () => {
    const sql = mockPublicationSql(safePublicationRow());
    mocks.getSql.mockReturnValue(sql);
    mocks.enrichScb.mockResolvedValue({
      status: "saved",
      saved: true,
      conflicts: [{
        field: "legal_name",
        code: "legal_name_mismatch",
        bolagsverket: "Exempel El AB",
        scb: "Annat Namn AB",
      }],
    });

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: false,
      code: "unsafe",
    });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["well-shaped Official Facts procedures", "jsonb_typeof(f.ongoing_procedures) = 'array'"],
    ["an SCB row with array-shaped no-conflict evidence", "jsonb_typeof(scb.conflicts) = 'array'"],
    ["an SCB row with no conflicts", "jsonb_array_length(scb.conflicts) = 0"],
    ["the exact refreshed SCB source hash", "scb.source_payload_hash = ?"],
    ["a matching profile snapshot", "{comparisonSnapshot,profileUpdatedToken}"],
    ["a matching Official Facts snapshot", "{comparisonSnapshot,officialFactsLastSyncedToken}"],
  ])("requires %s in the final atomic database gate", async (_label, requiredGuard) => {
    const sql = mockPublicationSql(safePublicationRow(), []);
    mocks.getSql.mockReturnValue(sql);

    const result = await publishCompanyDirectoryProfileIfSafe(PROFILE_ID);

    expect(result).toEqual({ ok: false, code: "not_ready" });
    expect(mocks.enrichScb).toHaveBeenCalledWith(PROFILE_ID);
    expect(sql).toHaveBeenCalledTimes(3);

    const finalCall = findSqlCall(sql, "update company_directory_profiles p");
    const finalQuery = executedQuery(finalCall);
    const finalValues = finalCall?.slice(1) ?? [];
    expect(finalQuery).toContain("company_directory_scb_enrichment");
    expect(finalQuery).toContain(requiredGuard);
    expect(finalValues).toContain(PROFILE_UPDATED_TOKEN);
    expect(finalValues).toContain(FACTS_LAST_SYNCED_TOKEN);
    expect(finalValues).toContain("scb-hash");
  });

  it("preserves PostgreSQL timestamp precision in the executed final publication gate", async () => {
    const sql = mockPublicationSql(safePublicationRow(), []);
    mocks.getSql.mockReturnValue(sql);

    await publishCompanyDirectoryProfileIfSafe(PROFILE_ID);

    const finalValues = findSqlCall(sql, "update company_directory_profiles p")?.slice(1) ?? [];
    expect(finalValues).toContain(PROFILE_UPDATED_TOKEN);
    expect(finalValues).toContain(FACTS_LAST_SYNCED_TOKEN);
  });

  it("does not publish when the final atomic gate finds a failed discovery-queue record", async () => {
    const sql = mockPublicationSql(safePublicationRow(), []);
    mocks.getSql.mockReturnValue(sql);

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: false,
      code: "not_ready",
    });
    expect(mocks.enrichScb).toHaveBeenCalledWith(PROFILE_ID);
    const finalQuery = executedQuery(findSqlCall(sql, "update company_directory_profiles p"));
    expect(finalQuery).toContain("company_directory_discovery_queue queue");
    expect(finalQuery).toContain("queue.state = 'failed'");
  });

  it("does not include failed discovery-queue profiles in automatic publication count or scan", async () => {
    const previousAutoPublish = process.env.COMPANY_DIRECTORY_AUTO_PUBLISH;
    process.env.COMPANY_DIRECTORY_AUTO_PUBLISH = "true";
    const queries: string[] = [];
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = Array.from(strings).join("?");
      queries.push(query);
      if (query.includes("select count(*)::int as count")) {
        expect(query).toContain("company_directory_discovery_queue queue");
        expect(query).toContain("queue.state = 'failed'");
        expect(query).toContain("company_directory_scb_enrichment scb");
        expect(query).toContain("jsonb_typeof(facts.ongoing_procedures) = 'array'");
        expect(query).toContain("scb.last_synced_at >= now() - interval '7 days'");
        expect(query).toContain("{comparisonSnapshot,profileUpdatedToken}");
        expect(query).toContain("{comparisonSnapshot,officialFactsLastSyncedToken}");
        expect(query).toContain("jsonb_typeof(scb.conflicts) = 'array'");
        expect(query).toContain("jsonb_array_length(scb.workplaces) = 1");
        expect(query).toContain("string_to_array(?, ',')");
        return [{ count: 1 }];
      }
      if (query.includes("from company_directory_profiles profile") && query.includes("offset ?")) {
        expect(query).toContain("company_directory_discovery_queue queue");
        expect(query).toContain("queue.state = 'failed'");
        expect(query).toContain("company_directory_scb_enrichment scb");
        expect(query).toContain("jsonb_typeof(facts.ongoing_procedures) = 'array'");
        expect(query).toContain("scb.last_synced_at >= now() - interval '7 days'");
        expect(query).toContain("{comparisonSnapshot,profileUpdatedToken}");
        expect(query).toContain("{comparisonSnapshot,officialFactsLastSyncedToken}");
        expect(query).toContain("jsonb_typeof(scb.conflicts) = 'array'");
        expect(query).toContain("jsonb_array_length(scb.workplaces) = 1");
        expect(query).toContain("string_to_array(?, ',')");
        return [];
      }
      throw new Error(`Unexpected automatic-publication SQL: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    try {
      await expect(autoPublishReadyHighConfidenceCompanyDirectoryBatch(10)).resolves.toMatchObject({
        safetyEligible: 1,
        scanned: 0,
        selected: 0,
        published: 0,
        errors: 0,
      });
      expect(queries).toHaveLength(2);
      expect(mocks.enrichScb).not.toHaveBeenCalled();
    } finally {
      if (previousAutoPublish === undefined) delete process.env.COMPANY_DIRECTORY_AUTO_PUBLISH;
      else process.env.COMPANY_DIRECTORY_AUTO_PUBLISH = previousAutoPublish;
    }
  });

  it("keeps terminal discovery-queue failures out of automatic publication scans", () => {
    const readyAutoPublish = source("src/lib/company-directory-ready-auto-publish.ts");

    expect(readyAutoPublish).toContain("company_directory_discovery_queue queue");
    expect(readyAutoPublish).toContain("queue.state = 'failed'");
    expect(readyAutoPublish).toContain("queue.profile_id = profile.id");
  });

  it("shows Official Facts freshness in the admin publication preview", () => {
    const admin = source("src/lib/company-directory-admin.ts");

    expect(admin).toContain("f.last_synced_at >= p.last_synced_at");
    expect(admin).toContain("f.source_payload_hash <> ''");
    expect(admin).toContain("as official_facts_fresh");
    expect(admin).toContain('publishSafetyReasons.push("official_facts_stale")');
  });
});
