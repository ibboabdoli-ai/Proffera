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

function profileId(index: number) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function candidate(index: number) {
  return {
    id: profileId(index),
    organization_number: `556311${String(5700 + index).padStart(4, "0")}`,
    display_name: `Batch Cap ${index + 1} AB`,
    publication_status: "review",
  };
}

function evaluation(id: string, index: number) {
  return {
    id,
    country_code: "SE",
    organization_kind: "juridical_person",
    publication_status: "review",
    category_slug: "elektriker",
    primary_sni_code: "43.210",
    legal_name: `Batch Cap ${index + 1} AB`,
    display_name: `Batch Cap ${index + 1} AB`,
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
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  transport.fetchCompany.mockReset();
  transport.fetchWorkplaces.mockReset();

  mocks.createScbTransport.mockReturnValue(transport);
  mocks.enrichOfficialFacts.mockResolvedValue({ reusedVerifiedDetail: false });
  mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
  mocks.assessConfidence.mockReturnValue({ score: 95, officialFactsReady: true, reasons: [] });
});

describe("full Company Directory revalidation batch cap", () => {
  it("processes at most ten profiles from an oversized candidate pool", async () => {
    const oversizedPool = Array.from({ length: 20 }, (_, index) => candidate(index));
    mocks.assessConfidence.mockReturnValue({ score: 90, officialFactsReady: true, reasons: [] });

    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = normalizeQuery(strings);

      if (query.includes("started_at < now() - interval '10 minutes'")) return [];
      if (query.includes("insert into company_directory_sync_runs")) return [{ id: RUN_ID }];

      if (query.includes("select profile.id::text, profile.organization_number, profile.display_name, profile.publication_status")) {
        const requestedLimit = Number(values.at(-1));
        expect(requestedLimit).toBe(10);
        return oversizedPool.slice(0, requestedLimit);
      }

      if (query.includes("profile.category_slug") && query.includes("scb_snapshot_fresh")) {
        const id = String(values[0]);
        const index = oversizedPool.findIndex((row) => row.id === id);
        if (index < 0) throw new Error(`Unexpected profile id in batch-cap evaluation: ${id}`);
        return [evaluation(id, index)];
      }

      if (query.includes("update company_directory_sync_runs") && query.includes("where id =")) return [];
      if (query.includes("select count(*)::int as count")) return [{ count: 0 }];
      throw new Error(`Unexpected SQL in batch-cap behavior test: ${query}`);
    });

    mocks.getSql.mockReturnValue(sql);

    const result = await revalidateAllCompanyDirectoryBatch(99);

    expect(result).toMatchObject({
      selected: 10,
      refreshed: 10,
      kept: 10,
      movedToReview: 0,
      errors: 0,
      remaining: 0,
    });
    expect(mocks.enrichOfficialFacts).toHaveBeenCalledTimes(10);
    expect(mocks.enrichScb).toHaveBeenCalledTimes(10);
  });
});
