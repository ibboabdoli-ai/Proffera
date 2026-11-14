import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  category: vi.fn(),
  enrichScb: vi.fn(),
  transport: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.category,
}));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.enrichScb,
}));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.transport,
}));
vi.mock("@/lib/company-directory-public-cache", () => ({
  invalidatePublicDirectoryPublicProjection: mocks.invalidate,
}));

import { enrichReadyCompanyDirectoryScbBatch } from "@/lib/company-directory-ready-scb-enrichment";
import { autoPublishReadyHighConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-ready-auto-publish";
import { publishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";

const PROFILE_TOKEN = "2026-10-17 05:00:00.000000+00";
const FACTS_TOKEN = "2026-10-17 05:01:00.000000+00";
const transport = { fetchCompany: vi.fn(), fetchWorkplaces: vi.fn() };

type SyntheticFixture = {
  id: string;
  org: string;
  name: string;
  slug: string;
  publicationStatus: "ready" | "published";
  queueState: "ready" | "published";
  result: "stockholm" | "sodertalje" | "outside_pilot" | "conflict" | "timeout";
  scb: null | { hash: string; conflicts: unknown[]; workplaces: unknown[] };
};

function makeFixtures(): SyntheticFixture[] {
  const scenarios = ["stockholm", "sodertalje", "outside_pilot", "conflict", "timeout"] as const;
  return scenarios.map((result, index) => ({
    id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    org: `99999460${String(index + 1).padStart(2, "0")}`,
    name: `QA946 Simulated Elektriker ${index + 1} AB`,
    slug: `qa946-elektriker-${index + 1}`,
    publicationStatus: "ready",
    queueState: "ready",
    result,
    scb: null,
  }));
}

function workplace(city: string, municipality = city) {
  return {
    cfarNumber: "TEST-ONLY",
    municipality,
    visitingAddress: { addressLine: "Testgatan 7", postalCode: "111 11", city },
    postalAddress: { addressLine: "Testgatan 7", postalCode: "111 11", city },
  };
}

function officialCategory(row: SyntheticFixture) {
  return {
    id: row.id,
    category_slug: "elektriker",
    primary_sni_code: "43.210",
    legal_name: row.name,
    display_name: row.name,
    activity_description: "Elinstallation och service",
    registered_names: [{ name: row.name, typeCode: "FORETAGSNAMN" }],
    sni_codes: [{ code: "43.210", label: "Elinstallationer" }],
  };
}

function publicationRow(row: SyntheticFixture) {
  return {
    ...officialCategory(row),
    public_slug: row.slug,
    address_line1: "Registrerad Testgatan 1",
    postal_code: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    publication_status: row.publicationStatus,
    is_active: true,
    privacy_blocked: false,
    auto_public_eligible: true,
    claimed_workspace_id: null,
    profile_updated_token: PROFILE_TOKEN,
    facts_profile_id: row.id,
    deregistration_date: null,
    advertising_blocked: false,
    ongoing_procedures: [],
    facts_last_synced_token: FACTS_TOKEN,
    facts_source_payload_hash: `facts-${row.org}`,
    official_facts_fresh: true,
    scb_workplaces: row.scb?.workplaces ?? null,
    scb_source_payload_hash: row.scb?.hash ?? null,
    scb_conflict_count: row.scb ? row.scb.conflicts.length : 1,
    scb_snapshot_fresh: Boolean(row.scb),
  };
}

function safeForPublication(row: SyntheticFixture) {
  return row.publicationStatus === "ready"
    && row.scb !== null
    && row.scb.conflicts.length === 0
    && (row.result === "stockholm" || row.result === "sodertalje");
}

function statefulSql(fixtures: SyntheticFixture[]) {
  return vi.fn(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const q = Array.from(parts).join("?").replace(/\s+/gu, " ").trim();
    // This adapter simulates DB reads/writes. The actual production SQL remains
    // authoritative and is separately covered by DB integration/contract tests.
    if (q.includes("md5(profile.organization_number") && q.includes("scb.profile_id is null")) {
      return fixtures
        .filter((row) => row.publicationStatus === "ready" && row.scb === null)
        .map(officialCategory);
    }
    if (q.includes("select count(*)::int as count") && q.includes("company_directory_scb_enrichment scb")) {
      return [{ count: fixtures.filter(safeForPublication).length }];
    }
    if (q.includes("order by profile.organization_number asc") && q.includes("company_directory_scb_enrichment scb")) {
      return fixtures.filter(safeForPublication).map(officialCategory);
    }
    if (q.includes("select p.id::text, p.public_slug") && q.includes("scb.workplaces as scb_workplaces")) {
      const row = fixtures.find((item) => item.id === values[0]);
      return row ? [publicationRow(row)] : [];
    }
    if (q.includes("update company_directory_profiles p") && q.includes("set publication_status = 'published'")) {
      expect(q).toContain("scb.source_payload_hash = ?");
      expect(q).toContain("{comparisonSnapshot,profileUpdatedToken}");
      expect(q).toContain("{comparisonSnapshot,officialFactsLastSyncedToken}");
      expect(q).toContain("not exists ( select 1 from company_directory_discovery_queue");
      const row = fixtures.find((item) => item.id === values[0]);
      if (!row || !safeForPublication(row)) return [];
      if (!values.includes(row.scb!.hash) || !values.includes(PROFILE_TOKEN) || !values.includes(FACTS_TOKEN)) return [];
      row.publicationStatus = "published";
      return [{ public_slug: row.slug }];
    }
    if (q.includes("update company_directory_discovery_queue queue") && q.includes("set state = 'published'")) {
      const row = fixtures.find((item) => item.id === values[0]);
      if (!row || row.publicationStatus !== "published" || row.queueState !== "ready") return [];
      row.queueState = "published";
      return [{ id: row.id }];
    }
    if (q.includes("scb.workplaces as scb_workplaces") && q.includes("scb_snapshot_fresh")) {
      const row = fixtures.find((item) => item.id === values[0]);
      return row ? [publicationRow(row)] : [];
    }
    throw new Error(`Unexpected SQL in simulated 5-profile flow: ${q.slice(0, 180)}`);
  });
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED", "true");
  vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH", "true");
  mocks.category.mockReturnValue({ officialFactsReady: true, score: 100 });
  mocks.transport.mockReturnValue(transport);
});

afterEach(() => vi.unstubAllEnvs());

describe("Ready -> mocked SCB -> fail-closed publication, five synthetic companies", () => {
  it("enriches in capped batches and publishes only the two with safe SCB workplaces", async () => {
    const fixtures = makeFixtures();
    const sql = statefulSql(fixtures);
    mocks.getSql.mockReturnValue(sql);

    // The upstream registry is never called: this is a deterministic response
    // simulation with distinct outcome classes for all five synthetic entities.
    mocks.enrichScb.mockImplementation(async (id: string, passedTransport?: unknown) => {
      const row = fixtures.find((item) => item.id === id);
      if (!row) throw new Error("Unknown synthetic fixture");
      if (row.result === "timeout") throw new Error("simulated SCB timeout");
      if (passedTransport && passedTransport !== transport) throw new Error("Unexpected SCB transport");
      const city = row.result === "sodertalje" ? "Södertälje"
        : row.result === "outside_pilot" ? "Uppsala" : "Stockholm";
      const conflicts = row.result === "conflict" ? [{ field: "sni_codes", code: "sni_no_overlap" }] : [];
      row.scb = {
        hash: `mock-scb-${row.org}`,
        conflicts,
        workplaces: [workplace(city)],
      };
      return { status: "saved", saved: true, conflicts };
    });

    const first = await enrichReadyCompanyDirectoryScbBatch({ limit: 3 });
    expect(first).toMatchObject({ attempted: 3, saved: 3, errors: 0 });
    const second = await enrichReadyCompanyDirectoryScbBatch({ limit: 3 });
    expect(second).toMatchObject({ attempted: 2, saved: 1, errors: 1 });
    expect(second.errorSummary).toContain("simulated SCB timeout");

    // Both workers use the real application logic; only SCB and SQL I/O are mocked.
    // The preflight itself does not publish any Ready company.
    expect(fixtures.every((row) => row.publicationStatus === "ready")).toBe(true);
    const result = await autoPublishReadyHighConfidenceCompanyDirectoryBatch();
    expect(result).toMatchObject({
      safetyEligible: 2, scanned: 2, highConfidence: 2,
      selected: 2, published: 2, queueSynced: 2, errors: 0,
    });
    expect(fixtures.map((row) => row.publicationStatus)).toEqual([
      "published", "published", "ready", "ready", "ready",
    ]);
    expect(fixtures.map((row) => row.queueState)).toEqual([
      "published", "published", "ready", "ready", "ready",
    ]);

    // Direct invocations of the real publication gate reject all unsafe evidence.
    await expect(publishCompanyDirectoryProfileIfSafe(fixtures[2].id))
      .resolves.toMatchObject({ ok: false, code: "unsafe" });
    await expect(publishCompanyDirectoryProfileIfSafe(fixtures[3].id))
      .resolves.toMatchObject({ ok: false, code: "unsafe" });
    await expect(publishCompanyDirectoryProfileIfSafe(fixtures[4].id))
      .resolves.toMatchObject({ ok: false, code: "not_ready" });

    const repeated = await autoPublishReadyHighConfidenceCompanyDirectoryBatch();
    expect(repeated).toMatchObject({ published: 0, queueSynced: 0 });
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
    expect(transport.fetchCompany).not.toHaveBeenCalled();
    expect(transport.fetchWorkplaces).not.toHaveBeenCalled();
  });
});
