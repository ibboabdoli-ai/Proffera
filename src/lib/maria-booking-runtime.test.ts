import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/lib/email-runtime-config", () => ({ resolveBrevoApiKey: vi.fn() }));
vi.mock("@/lib/maria-preview-booking", () => ({ getMariaPreviewBookingReadiness: vi.fn() }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: vi.fn(),
}));

import { getSql } from "@/lib/db/server";
import { resolveBrevoApiKey } from "@/lib/email-runtime-config";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";
import { getMariaBookingReadiness } from "./maria-booking-runtime";

const flags = {
  VERCEL_ENV: "production",
  PROFFERA_MARIA_PUBLIC_SITE_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_ORIGIN: "https://makeupbymaria.se",
};

const schema = {
  ledger: true, closed_starts: true, translations: true,
  verifications: true, contact_columns: true,
};
const schemaContract = {
  manual_closed_columns: true, card_translations_columns: true,
  manual_closed_pk: true, card_translations_pk: true,
  manual_closed_fk: true, card_translations_fk: true,
};
const workspace = {
  workspace_id: "11111111-2222-4333-8444-555555555555",
  public_booking_slug: "makeup-by-maria", company_name: "Makeup by Maria",
  primary_city: "Södertälje", owner_email: "manager@example.com",
  owner_phone: "", time_zone: "Europe/Stockholm", billing_currency: "SEK",
};

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

function enableProduction() {
  for (const [key, value] of Object.entries(flags)) vi.stubEnv(key, value);
  vi.mocked(resolveBrevoApiKey).mockReturnValue("synthetic-email-provider-key");
}

function stubSql(...results: Array<Array<Record<string, unknown>>>) {
  const query = vi.fn();
  results.forEach((value, index) => query.mockResolvedValueOnce(value));
  vi.mocked(getSql).mockReturnValue(query as unknown as ReturnType<typeof getSql>);
  return query;
}

describe("Maria Production readiness is independent and disabled by default", () => {
  it("does not touch the database when Production flags are missing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
    expect(getSql).not.toHaveBeenCalled();
  });

  it("preserves the original Preview-only readiness and email allowlist boundary", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.mocked(getMariaPreviewBookingReadiness).mockResolvedValue({enabled:false});
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
    expect(getMariaPreviewBookingReadiness).toHaveBeenCalledTimes(1);
    expect(getSql).not.toHaveBeenCalled();
  });

  it("refuses missing provider configuration before issuing booking writes", async () => {
    enableProduction();
    vi.mocked(resolveBrevoApiKey).mockReturnValue(null);
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
    expect(getSql).not.toHaveBeenCalled();
  });

  it("requires actual schema and all three canonical migration receipts", async () => {
    enableProduction();
    const missing = stubSql([{...schema, closed_starts:false}]);
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
    expect(missing).toHaveBeenCalledTimes(1);
    stubSql([schema], [schemaContract], [{count:2}]);
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
  });

  it("refuses missing published Maria workspace, non-SEK currency, or no entitlement", async () => {
    enableProduction();
    stubSql([schema], [schemaContract], [{count:3}], []);
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
    stubSql([schema], [schemaContract], [{count:3}], [{...workspace,billing_currency:"EUR"}]);
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
    stubSql([schema], [schemaContract], [{count:3}], [workspace]);
    vi.mocked(hasWorkspaceFeatureAccessForWorkspace).mockResolvedValue(false);
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
  });

  it("rejects partial canonical 0072/0074 schema despite migration receipts", async () => {
    enableProduction();
    for (const failed of [
      "manual_closed_columns", "card_translations_columns", "manual_closed_pk",
      "card_translations_pk", "manual_closed_fk", "card_translations_fk",
    ] as const) {
      const query = stubSql([schema], [{ ...schemaContract, [failed]: false }]);
      expect(await getMariaBookingReadiness()).toEqual({ enabled: false });
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[1]?.[0]?.join(" ")).toContain("pg_constraint");
    }
  });

  it("keeps Production booking closed even with valid schema, provider, workspace and entitlement", async () => {
    enableProduction();
    const query=stubSql([schema], [schemaContract], [{count:3}], [workspace]);
    vi.mocked(hasWorkspaceFeatureAccessForWorkspace).mockResolvedValue(true);
    const result=await getMariaBookingReadiness();
    expect(result).toEqual({enabled:false});
    expect(query).toHaveBeenCalledTimes(4);
    expect(hasWorkspaceFeatureAccessForWorkspace)
      .toHaveBeenCalledWith(workspace.workspace_id,"online_booking");
    // There is no Production OTP/manager acceptance path yet; configuration
    // flags must not falsely advertise a usable public booking lifecycle.
  });
});
