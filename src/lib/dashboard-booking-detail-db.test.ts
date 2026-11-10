import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://isolated-test.invalid/test",
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: vi.fn(),
}));

import { neon } from "@neondatabase/serverless";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getDashboardBookingDetailInStockholm } from "./dashboard-booking-detail-db";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Dashboard booking detail membership gate", () => {
  it.each(["no_session", "no_user", "no_membership", "workspace_not_allowed"] as const)(
    "returns no booking and does not query the database for %s",
    async (reason) => {
      vi.mocked(getUserWorkspaceAccess).mockResolvedValue({ ok: false, reason });
      expect(await getDashboardBookingDetailInStockholm("c0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff")).toBeNull();
      expect(neon).not.toHaveBeenCalled();
    },
  );

  it("isolates booking details between workspaces while still showing the member's own booking", async () => {
    const ownWorkspaceId = "19fecc58-08ba-406e-b3b7-090df9401cf7";
    const foreignWorkspaceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const ownBookingId = "c0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff";
    const foreignBookingId = "b0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff";
    vi.mocked(getUserWorkspaceAccess).mockResolvedValue({
      ok: true,
      userId: "qa-user",
      workspaceId: ownWorkspaceId,
      workspaceSlug: "makeup-by-maria",
      workspaceName: "Makeup by Maria",
      workspaceStatus: "active",
      role: "owner",
    });
    const fixtures = [
      { id: ownBookingId, workspace_id: ownWorkspaceId, title: "Authorized appointment", status: "confirmed", customer_id: null },
      { id: foreignBookingId, workspace_id: foreignWorkspaceId, title: "Foreign private appointment", status: "confirmed", customer_id: null },
    ];
    // The local fixture must fail visibly if the real SQL loses its workspace
    // filter: it would return the foreign appointment by booking ID alone.
    const sql = vi.fn(async (parts: TemplateStringsArray, ...bound: unknown[]) => {
      const query = Array.from(parts)
        .map((part, i) => part + (i < bound.length ? "$" + (i + 1) : ""))
        .join("");
      if (query.includes("from bookings b")) {
        const candidate = fixtures.find((row) => bound.includes(row.id));
        const hasWorkspacePredicate = /where\s+b\.workspace_id\s*=\s*\$\d+/u.test(query);
        const allowed = !hasWorkspacePredicate || bound.includes(candidate?.workspace_id);
        return candidate && allowed ? [candidate] : [];
      }
      if (query.includes("from workspace_settings")) return [{ time_zone: "Europe/Stockholm" }];
      return [];
    });
    vi.mocked(neon).mockReturnValue(sql as never);

    expect(await getDashboardBookingDetailInStockholm(foreignBookingId)).toBeNull();
    const ownDetail = await getDashboardBookingDetailInStockholm(ownBookingId);
    expect(ownDetail?.booking.id).toBe(ownBookingId);
    expect(ownDetail?.booking.title).toBe("Authorized appointment");
    expect(neon).toHaveBeenCalledTimes(2);

    const bookingCalls = sql.mock.calls.filter(([parts]) =>
      (parts as unknown as TemplateStringsArray).join("").includes("from bookings b"));
    expect(bookingCalls).toHaveLength(2);
    for (const [parts, ...values] of bookingCalls) {
      const text = Array.from(parts as unknown as TemplateStringsArray)
        .map((part, i) => part + (i < values.length ? "$" + (i + 1) : ""))
        .join("");
      expect(text).toMatch(/where b\.workspace_id = \$1\s+and b\.id = \$2/u);
      expect(values[0]).toBe(ownWorkspaceId);
    }
  });

  it("only attempts a workspace-scoped lookup after valid membership", async () => {
    vi.mocked(getUserWorkspaceAccess).mockResolvedValue({
      ok: true,
      userId: "qa-user",
      workspaceId: "19fecc58-08ba-406e-b3b7-090df9401cf7",
      workspaceSlug: "makeup-by-maria",
      workspaceName: "Makeup by Maria",
      workspaceStatus: "active",
      role: "owner",
    });
    const sql = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ time_zone: "Europe/Stockholm" }]);
    vi.mocked(neon).mockReturnValue(sql as never);
    expect(await getDashboardBookingDetailInStockholm("c0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff")).toBeNull();
    expect(neon).toHaveBeenCalledTimes(1);
    expect(sql).toHaveBeenCalledTimes(2);
  });
});
