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

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_UPDATED_TOKEN = "2026-08-22 20:00:00.123456+00";
const FACTS_LAST_SYNCED_TOKEN = "2026-08-22 19:59:00.654321+00";

function scbWorkplace(city = "Stockholm", municipality = "Stockholm") {
  return {
    cfarNumber: "12345678",
    municipality,
    visitingAddress: {
      addressLine: "Arbetsplatsgatan 2",
      postalCode: "11122",
      city,
    },
  };
}

function readyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    public_slug: "exempel-el",
    display_name: "Exempel El AB",
    legal_name: "Exempel El AB",
    category_slug: "elektriker",
    primary_sni_code: "43.210",
    activity_description: "Elinstallationer",
    address_line1: "Registrerad gata 1",
    postal_code: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
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
    scb_workplaces: [scbWorkplace()],
    scb_source_payload_hash: "scb-hash",
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

function staleRefreshSql(
  initialRow: Record<string, unknown>,
  refreshedRow: Record<string, unknown>,
  finalRows: unknown[] = [{ public_slug: "exempel-el" }],
) {
  let callCount = 0;
  return vi.fn(async () => {
    callCount += 1;
    if (callCount === 1) return [initialRow];
    if (callCount === 2) return [refreshedRow];
    return finalRows;
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
    expect(finalQuery).toContain("jsonb_typeof(scb.conflicts) = 'array'");
    expect(finalQuery).toContain("jsonb_array_length(scb.conflicts) = 0");
    expect(finalQuery).toContain("scb.source_payload_hash = ?");
    expect(finalQuery).toContain("scb.last_synced_at >= now() - interval '7 days'");
    expect(finalQuery).toContain("{comparisonSnapshot,profileUpdatedToken}");
    expect(finalQuery).toContain("{comparisonSnapshot,officialFactsLastSyncedToken}");
    expect(finalQuery).not.toContain("updated_at = now()");
    expect(sql.mock.calls[1]?.slice(1)).toEqual(expect.arrayContaining([
      PROFILE_UPDATED_TOKEN,
      FACTS_LAST_SYNCED_TOKEN,
      "scb-hash",
    ]));
  });

  it("preserves the validated snapshot token only for publication bookkeeping", () => {
    const publicationSource = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-publication.ts"),
      "utf8",
    );
    const sourceSyncSource = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-engine.ts"),
      "utf8",
    );

    const publicationUpdate = publicationSource.slice(
      publicationSource.indexOf("update company_directory_profiles p"),
      publicationSource.indexOf("returning p.public_slug"),
    );
    expect(publicationUpdate).toContain("p.updated_at::text = ${profileUpdatedToken}");
    expect(publicationUpdate).not.toContain("updated_at = now()");
    expect(sourceSyncSource).toContain("updated_at = now()");
  });

  it("fails closed when the profile is in-pilot but the canonical workplace is outside the pilot", async () => {
    const sql = mockSql(readyRow({
      scb_workplaces: [scbWorkplace("Uppsala", "Uppsala")],
    }));
    mocks.getSql.mockReturnValue(sql);

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: false,
      code: "unsafe",
    });

    expect(mocks.enrichScb).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
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

  it("refreshes stale SCB evidence, re-reads it, and publishes only the exact refreshed snapshot", async () => {
    const sql = staleRefreshSql(
      readyRow({ scb_snapshot_fresh: false, scb_source_payload_hash: "old-scb-hash" }),
      readyRow({ scb_source_payload_hash: "refreshed-scb-hash" }),
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toMatchObject({
      ok: true,
      code: "published",
    });

    expect(mocks.enrichScb).toHaveBeenCalledTimes(1);
    expect(mocks.enrichScb).toHaveBeenCalledWith(PROFILE_ID);
    expect(sql).toHaveBeenCalledTimes(3);
    expect(sql.mock.calls[2]?.slice(1)).toEqual(expect.arrayContaining(["refreshed-scb-hash"]));
  });

  it("fails closed if a refreshed SCB snapshot resolves outside the pilot", async () => {
    const sql = staleRefreshSql(
      readyRow({ scb_snapshot_fresh: false }),
      readyRow({
        scb_workplaces: [scbWorkplace("Uppsala", "Uppsala")],
        scb_source_payload_hash: "refreshed-scb-hash",
      }),
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });

    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: false,
      code: "unsafe",
    });

    expect(sql).toHaveBeenCalledTimes(2);
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
