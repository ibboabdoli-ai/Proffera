import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  sqlText: "",
  sqlValues: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));

import { startMariaPreviewInternalTrial } from "@/lib/admin-billing-mutations";

const MARIA_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const savedVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VERCEL_ENV = "preview";
  mocks.rows = [{ workspace_id: MARIA_ID }];
  mocks.sqlText = "";
  mocks.sqlValues = [];
  mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin", userId: "admin-1" });
  mocks.getSql.mockReturnValue(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    mocks.sqlText = parts.join("?");
    mocks.sqlValues = values;
    return mocks.rows;
  });
});

afterEach(() => {
  if (savedVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = savedVercelEnv;
});

describe("Maria first Preview-only internal trial", () => {
  const input = { workspaceId: MARIA_ID, reason: "Internal manual calendar test" };

  it("refuses every environment except Vercel Preview before database access", async () => {
    for (const env of ["production", "development", ""]) {
      process.env.VERCEL_ENV = env;
      await expect(startMariaPreviewInternalTrial(input)).rejects.toThrow("Preview-only");
    }
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("requires super_admin (billing_admin alone cannot start a new trial)", async () => {
    mocks.getPlatformAdmin.mockResolvedValue({ role: "billing_admin", userId: "admin-1" });
    await expect(startMariaPreviewInternalTrial(input)).rejects.toThrow("Super admin");
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("rejects invalid identifiers and missing audit reason", async () => {
    await expect(startMariaPreviewInternalTrial({ ...input, workspaceId: "makeup-by-maria" })).rejects.toThrow("Invalid workspace");
    await expect(startMariaPreviewInternalTrial({ ...input, reason: "test" })).rejects.toThrow("reason");
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("atomically guards against payments, existing subscriptions and duplicate trials", async () => {
    await expect(startMariaPreviewInternalTrial(input)).resolves.toEqual({ workspaceId: MARIA_ID });
    const sql = mocks.sqlText;
    expect(sql).toContain("pg_try_advisory_xact_lock");
    expect(sql).toContain("w.slug = 'makeup-by-maria'");
    expect(sql).toContain("not exists (");
    expect(sql).toContain("from workspace_plans");
    expect(sql).toContain("from workspace_billing_subscriptions");
    expect(sql).toContain("feature_key = 'online_booking'");
    expect(sql).toContain("and o.enabled = false");
    expect(sql).toContain("interval '14 days'");
    expect(sql).toContain("billing.maria_preview_trial_started");
    expect(sql).toContain("join enabled_feature");
    expect(mocks.sqlValues).toEqual([MARIA_ID, "admin-1", input.reason]);
    expect(sql).not.toMatch(/insert into workspace_billing_subscriptions|insert into stripe_/i);
  });

  it("fails closed when no eligible Preview workspace was written", async () => {
    mocks.rows = [];
    await expect(startMariaPreviewInternalTrial(input)).rejects.toThrow("Trial not started");
  });

  it("fails closed when the Preview database is absent", async () => {
    mocks.getSql.mockReturnValue(null);
    await expect(startMariaPreviewInternalTrial(input)).rejects.toThrow("Preview database unavailable");
  });
});
