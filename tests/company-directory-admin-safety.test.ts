import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
  assessConfidence: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));

import { getCompanyDirectoryAdminSnapshot } from "@/lib/company-directory-admin";

function queryText(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    public_slug: "exempel-el-ab",
    display_name: "Exempel El AB",
    legal_name: "Exempel El AB",
    legal_form: "Aktiebolag",
    city: "Södertälje",
    municipality: "Södertälje",
    category_slug: "elektriker",
    primary_sni_code: "43.210",
    primary_sni_label: "Elinstallationer",
    activity_description: "Elinstallation och service",
    publication_status: "ready",
    quality_score: 95,
    privacy_blocked: false,
    auto_public_eligible: true,
    is_active: true,
    official_source: "bolagsverket",
    last_synced_at: "2026-08-21T08:00:00.000Z",
    profile_updated_token: "2026-08-21T08:00:00.000Z",
    claimed_workspace_id: null,
    address_line1: "",
    postal_code: "",
    website_url: "",
    scb_phone: "",
    scb_email: "",
    scb_postal_address: {},
    scb_last_synced_at: "2026-08-21T08:00:00.000Z",
    scb_source_payload_hash: "scb-hash",
    scb_conflict_count: 0,
    registered_names: [{ name: "Exempel El AB", specialBusinessDescription: "" }],
    sni_codes: [{ code: "43.210", label: "Elinstallationer" }],
    deregistration_date: null,
    advertising_blocked: false,
    ongoing_procedures: [],
    official_facts_fresh: true,
    scb_snapshot_fresh: true,
    ...overrides,
  };
}

function configureSnapshot(row: Record<string, unknown>) {
  const sql = vi.fn(async (strings: TemplateStringsArray) => {
    const query = queryText(strings);
    if (query.includes("group by publication_status")) return [{ publication_status: "ready", count: 1 }];
    if (query.includes("from company_directory_claims")) return [{ count: 0 }];
    if (query.includes("from company_directory_sync_runs")) return [];
    if (query.includes("select count(*)::int as count")) return [{ count: 1 }];
    if (query.includes("select p.id::text")) return [row];
    throw new Error(`Unexpected admin snapshot query: ${query}`);
  });
  mocks.getSql.mockReturnValue(sql);
  return sql;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin" });
  mocks.assessConfidence.mockReturnValue({
    score: 95,
    level: "high",
    signals: [],
    warnings: [],
    officialFactsReady: true,
  });
});

describe("Company Directory admin publication safety", () => {
  it("keeps stale SCB, SCB conflicts, and safe Review recovery visibly non-publishable", async () => {
    const staleSql = configureSnapshot(profileRow({ scb_snapshot_fresh: false }));
    const stale = await getCompanyDirectoryAdminSnapshot({ status: "ready" });
    expect(stale.profiles[0]).toMatchObject({
      publishSafe: false,
      publishSafetyReasons: ["scb_evidence_stale"],
    });
    expect(queryText(staleSql.mock.calls.at(-1)?.[0] as TemplateStringsArray))
      .toContain("scb.last_synced_at >= now() - interval '7 days'");

    configureSnapshot(profileRow({ scb_conflict_count: 1 }));
    const conflicted = await getCompanyDirectoryAdminSnapshot({ status: "ready" });
    expect(conflicted.profiles[0]).toMatchObject({
      publishSafe: false,
      publishSafetyReasons: ["scb_conflict"],
    });

    configureSnapshot(profileRow({ publication_status: "review" }));
    const recoverable = await getCompanyDirectoryAdminSnapshot({ status: "review" });
    expect(recoverable.profiles[0]).toMatchObject({
      publishSafe: false,
      publishSafetyReasons: ["review_recovery_eligible"],
    });
  });
});
