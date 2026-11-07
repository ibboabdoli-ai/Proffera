import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  workspaceSlug: "makeup-by-maria",
  sqlCalls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic.invalid/isolated",
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    fixture.sqlCalls += 1;
    throw new Error("synthetic SQL must not be opened");
  },
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true,
    workspaceSlug: fixture.workspaceSlug,
    workspaceId: "00000000-0000-4000-8000-000000000001",
  }),
  canManageWorkspaceSettings: () => true,
}));

import { moveDashboardCalendarBooking } from "./dashboard-calendar-move";

describe("Maria Preview calendar drag-and-drop safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    fixture.workspaceSlug = "makeup-by-maria";
    fixture.sqlCalls = 0;
  });

  it("refuses generic moves before opening SQL: use the locked Maria rescheduler instead", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(moveDashboardCalendarBooking({
      bookingId: "00000000-0000-4000-8000-000000000002",
      localStartsAt: "2026-11-13T07:00",
      staffId: "",
    })).rejects.toMatchObject({ code: "maria_preview" });
    expect(fixture.sqlCalls).toBe(0);
  });

  it("does not change the generic calendar move behavior of unrelated workspaces", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    fixture.workspaceSlug = "unrelated-company";
    await expect(moveDashboardCalendarBooking({
      bookingId: "00000000-0000-4000-8000-000000000002",
      localStartsAt: "2026-11-13T07:00",
      staffId: "",
    })).rejects.toThrow("synthetic SQL must not be opened");
    expect(fixture.sqlCalls).toBe(1);
  });
});
