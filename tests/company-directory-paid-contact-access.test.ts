import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));

import { getCompanyDirectoryAdminSnapshot } from "@/lib/company-directory-admin";
import { hasActivePaidDirectoryContactAccess } from "@/lib/company-directory-paid-contact-entitlement";

const workspaceId = "11111111-1111-4111-8111-111111111111";

describe("paid Directory contact access", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.getPlatformAdmin.mockReset();
    mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin" });
  });

  it("keeps Trial locked even when the trial has a Starter plan key", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      plan_key: "starter",
      status: "trialing",
      current_period_end: "2099-01-01T00:00:00.000Z",
    }]));

    await expect(hasActivePaidDirectoryContactAccess(workspaceId)).resolves.toBe(false);
  });

  it("unlocks Starter only when plan status is active", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      plan_key: "starter",
      status: "active",
      current_period_end: null,
    }]));

    await expect(hasActivePaidDirectoryContactAccess(workspaceId)).resolves.toBe(true);
  });

  it("unlocks a supported higher-tier active plan", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      plan_key: "professional",
      status: "active",
      current_period_end: null,
    }]));

    await expect(hasActivePaidDirectoryContactAccess(workspaceId)).resolves.toBe(true);
  });

  it("fails closed when plan lookup fails", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => { throw new Error("db unavailable"); }));
    await expect(hasActivePaidDirectoryContactAccess(workspaceId)).resolves.toBe(false);
  });
});

describe("super-admin Directory contact visibility", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.getPlatformAdmin.mockReset();
    mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin" });
  });

  it("returns raw SCB and profile contact values to an authorized super-admin", async () => {
    const profileRow = {
      id: "33333333-3333-4333-8333-333333333333",
      public_slug: "example-vvs-ab-123456",
      display_name: "Example VVS AB",
      legal_name: "Example VVS AB",
      legal_form: "Aktiebolag",
      city: "Stockholm",
      municipality: "Stockholm",
      category_slug: "vvs",
      primary_sni_code: "43.221",
      primary_sni_label: "VVS-arbeten",
      activity_description: "Bolaget bedriver VVS-installationer och rörservice.",
      publication_status: "published",
      quality_score: 100,
      privacy_blocked: false,
      auto_public_eligible: true,
      is_active: true,
      official_source: "bolagsverket",
      last_synced_at: "2026-08-19T20:00:00.000Z",
      claimed_workspace_id: null,
      address_line1: "Profilegatan 1",
      postal_code: "111 11",
      website_url: "https://example.se",
      scb_phone: "0701234567",
      scb_email: "kontakt@example.se",
      scb_postal_address: {
        addressLine: "SCB-gatan 2",
        postalCode: "111 22",
        city: "Stockholm",
      },
      scb_last_synced_at: "2026-08-19T21:00:00.000Z",
      registered_names: ["Example VVS AB"],
      sni_codes: [{ code: "43.221", label: "VVS-arbeten" }],
      deregistration_date: null,
      advertising_blocked: false,
      ongoing_procedures: [],
      official_facts_fresh: true,
    };

    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("group by publication_status")) {
        return [{ publication_status: "published", count: 1 }];
      }
      if (query.includes("from company_directory_claims")) return [{ count: 0 }];
      if (query.includes("from company_directory_sync_runs")) return [];
      if (query.includes("select count(*)::int as count") && query.includes("from company_directory_profiles p")) {
        return [{ count: 1 }];
      }
      if (query.includes("left join company_directory_scb_enrichment scb")) return [profileRow];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const snapshot = await getCompanyDirectoryAdminSnapshot({ status: "published", pageSize: 10 });

    expect(mocks.getPlatformAdmin).toHaveBeenCalledTimes(1);
    expect(snapshot.profiles).toHaveLength(1);
    expect(snapshot.profiles[0]?.categorySignals).toEqual(expect.arrayContaining([
      "Admin · Telefon: 0701234567",
      "Admin · E-post: kontakt@example.se",
      "Admin · Webbplats: https://example.se",
      "Admin · Adress: Profilegatan 1, 111 11 Stockholm",
      "Admin · SCB-kontakt senast synkad: 2026-08-19T21:00:00.000Z",
    ]));
  });

  it("rejects a non-super-admin before querying Directory data", async () => {
    mocks.getPlatformAdmin.mockResolvedValue({ role: "billing_admin" });

    await expect(getCompanyDirectoryAdminSnapshot()).rejects.toThrow("Super admin access required");
    expect(mocks.getSql).not.toHaveBeenCalled();
  });
});
