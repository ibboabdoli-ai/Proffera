import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the actual payment writer rather than checking text in its source.
// Email delivery and SMS Preview gates have separate behavioral tests in
// maria-deposit-email.test.ts and booking-sms.test.ts.
const guards = vi.hoisted(() => ({
  access: vi.fn(),
  canManage: vi.fn(),
  moduleAccess: vi.fn(),
  approvedRecipient: vi.fn(),
  getSql: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: guards.access,
  canManageWorkspaceSettings: guards.canManage,
}));
vi.mock("@/lib/workspace-module-access", () => ({
  hasDashboardModuleAccess: guards.moduleAccess,
}));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  isMariaPreviewTestRecipient: guards.approvedRecipient,
}));
vi.mock("@/lib/db/server", () => ({ getSql: guards.getSql }));

import { setMariaManualSwishStatus } from "@/lib/maria-manual-swish";

const assetPath = "public/demo/makeup-by-maria/assets/maria-swish-qr.jpg";
const bookingId = "00000000-0000-4000-8000-000000000123";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const sql = Object.assign(
  vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  })),
  { transaction: guards.transaction },
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  guards.access.mockResolvedValue({
    ok: true, workspaceSlug: "makeup-by-maria", workspaceId, userId: "qa-manager",
  });
  guards.canManage.mockReturnValue(true);
  guards.moduleAccess.mockResolvedValue(true);
  guards.approvedRecipient.mockReturnValue(true);
  guards.getSql.mockReturnValue(sql);
  guards.transaction.mockResolvedValue([[], [{ eligible_count: 1, inserted_count: 1 }]]);
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("Makeup by Maria Preview deposit safety", () => {
  it("ships the customer-supplied QR asset as a local JPEG", () => {
    const image = readFileSync(resolve(process.cwd(), assetPath));
    expect(statSync(resolve(process.cwd(), assetPath)).size).toBeGreaterThan(100_000);
    expect(Array.from(image.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
  });

  it("never attempts a payment write in Production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
    expect(guards.getSql).not.toHaveBeenCalled();
    expect(guards.transaction).not.toHaveBeenCalled();
  });

  it("never writes for another workspace", async () => {
    guards.access.mockResolvedValue({
      ok: true, workspaceSlug: "another-business", workspaceId, userId: "qa-manager",
    });
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
    expect(guards.getSql).not.toHaveBeenCalled();
  });

  it("never writes when the signed-in user is not a manager", async () => {
    guards.canManage.mockReturnValue(false);
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
    expect(guards.getSql).not.toHaveBeenCalled();
  });

  it("never writes without booking module access", async () => {
    guards.moduleAccess.mockResolvedValue(false);
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
    expect(guards.getSql).not.toHaveBeenCalled();
  });

  it("never writes when the QA recipient is not approved", async () => {
    guards.approvedRecipient.mockReturnValue(false);
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_FORBIDDEN");
    expect(guards.getSql).not.toHaveBeenCalled();
  });

  it("never writes for a malformed booking ID", async () => {
    await expect(setMariaManualSwishStatus("../another-booking", "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_INVALID");
    expect(guards.access).not.toHaveBeenCalled();
    expect(guards.transaction).not.toHaveBeenCalled();
  });

  it("uses one booking-locked, scoped transaction for an authorized manual mark", async () => {
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .resolves.toEqual({ changed: true });
    expect(guards.transaction).toHaveBeenCalledTimes(1);
    const statements = guards.transaction.mock.calls[0]?.[0] as
      Array<{ strings: string[]; values: unknown[] }>;
    expect(statements).toHaveLength(2);
    const query = statements.map((part) => part.strings.join("?")).join("\n");
    expect(query).toContain("pg_advisory_xact_lock");
    expect(query).toContain("insert into customer_events");
    expect(query).toContain("join workspaces w");
    expect(query).toContain("lower(btrim(c.email, chr(9) || chr(10) || chr(13) || ' '))");
    expect(statements[1]?.values).toContain(workspaceId);
    expect(statements[1]?.values).toContain("qa@example.invalid");
  });

  it("does not claim an additional payment on an unchanged manual status", async () => {
    guards.transaction.mockResolvedValue([[], [{ eligible_count: 1, inserted_count: 0 }]]);
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .resolves.toEqual({ changed: false });
  });

  it("rejects an ineligible booking instead of reporting payment recorded", async () => {
    guards.transaction.mockResolvedValue([[], [{ eligible_count: 0, inserted_count: 0 }]]);
    await expect(setMariaManualSwishStatus(bookingId, "paid"))
      .rejects.toThrow("MARIA_MANUAL_SWISH_INELIGIBLE");
  });
});
