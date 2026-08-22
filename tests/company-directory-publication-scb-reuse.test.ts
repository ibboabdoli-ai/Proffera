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

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_UPDATED_TOKEN = "2026-08-22 20:00:00.123456+00";
const FACTS_LAST_SYNCED_TOKEN = "2026-08-22 19:59:00.654321+00";

function readyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    public_slug: "exempel-el",
    display_name: "Exempel El AB",
    legal_name: "Exempel El AB",
    category_slug: "elektriker",
    primary_sni_code: "43.210",
    activity_description: "Elinstallationer",
    publication_status: "ready",
    is_active: true,
    privacy_blocked: false,
    auto_public_eligible: true,
    claimed_workspace_id: null,
    profile_updated_token: PROFILE_UPDATED_TOKEN,
    facts_profile_id: PROFILE_ID,
    registered_names: [{ name: "Exempel El AB", typeCode: "FORETAGSNAMN" }],
    sni_codes: [{ code: "43.210", label: "Elinstallationer" }],
    deregistration_date: null,
    advertising_blocked: false,
    ongoing_procedures: [],
    facts_last_synced_token: FACTS_LAST_SYNCED_TOKEN,
    facts_source_payload_hash: "official-facts-hash",
    official_facts_fresh: true,
    scb_conflict_count: 0,
    scb_snapshot_fresh: true,
    ...overrides,
  };
}

function mockSql(row: Record<string, unknown>, finalRows: unknown[] = [{ public_slug: "exempel-el" }]) {
  let callCount = 0;
  return vi.fn(async () => {
    callCount += 1;
    return callCount === 1 ? [row] : finalRows;
  });
}

function executedQuery(call: unknown[] | undefined) {
  const strings = call?.[0] as TemplateStringsArray | undefined;
  return strings ? Array.from(strings).join("?") : "";
}

describe("Directory publication SCB evidence reuse", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.enrichScb.mockReset();
    mocks.assessConfidence.mockReset();
    mocks.assessConfidence.mockReturnValue({ score: 100, officialFactsReady: true });
  });

  it("publishes from fresh snapshot-bound SCB evidence without another upstream lookup", async () => {
    const sql = mockSql(readyRow());
    mocks.getSql.mockReturnValue(sql);

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: true,
      code: "published",
      slug: "exempel-el",
    });

    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(2);

    const finalQuery = executedQuery(sql.mock.calls[1]);
    expect(finalQuery).toContain("jsonb_array_length(coalesce(scb.conflicts, '[]'::jsonb)) = 0");
    expect(finalQuery).toContain("scb.source_payload_hash <> ''");
    expect(finalQuery).toContain("scb.last_synced_at >= now() - interval '7 days'");
    expect(finalQuery).toContain("{comparisonSnapshot,profileUpdatedToken}");
    expect(finalQuery).toContain("{comparisonSnapshot,officialFactsLastSyncedToken}");
    expect(sql.mock.calls[1]?.slice(1)).toEqual(expect.arrayContaining([
      PROFILE_UPDATED_TOKEN,
      FACTS_LAST_SYNCED_TOKEN,
    ]));
  });

  it("fails closed on a conflict in fresh snapshot-bound SCB evidence", async () => {
    const sql = mockSql(readyRow({ scb_conflict_count: 1 }));
    mocks.getSql.mockReturnValue(sql);

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: false,
      code: "unsafe",
    });

    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("refreshes SCB only when the stored evidence is missing or stale", async () => {
    const sql = mockSql(readyRow({ scb_snapshot_fresh: false }));
    mocks.getSql.mockReturnValue(sql);
    mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toMatchObject({
      ok: true,
      code: "published",
    });

    expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
    expect(mocks.enrichScb).toHaveBeenCalledWith(PROFILE_ID);
  });

  it("still fails closed when stale SCB evidence cannot be refreshed", async () => {
    const sql = mockSql(readyRow({ scb_snapshot_fresh: false }));
    mocks.getSql.mockReturnValue(sql);
    mocks.enrichScb.mockResolvedValue({ status: "disabled", saved: false, conflicts: [] });

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: false,
      code: "not_ready",
    });

    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a stale SCB refresh request throws", async () => {
    const sql = mockSql(readyRow({ scb_snapshot_fresh: false }));
    mocks.getSql.mockReturnValue(sql);
    mocks.enrichScb.mockRejectedValueOnce(new Error("SCB timed out"));

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: false,
      code: "not_ready",
    });

    expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
