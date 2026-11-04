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
