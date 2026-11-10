import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  workspaceSlug: "makeup-by-maria",
  openedSqlClients: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic.invalid/isolated",
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    fixture.openedSqlClients += 1;
    throw new Error("Synthetic SQL must not open for protected Maria Production");
  },
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true,
    workspaceSlug: fixture.workspaceSlug,
    workspaceId: "00000000-0000-4000-8000-000000000001",
    role: "owner",
  }),
  canManageWorkspaceSettings: () => true,
}));

import { assignStaffToBooking } from "./dashboard-staff-bookings";

afterEach(() => {
  vi.unstubAllEnvs();
  fixture.workspaceSlug = "makeup-by-maria";
  fixture.openedSqlClients = 0;
});

describe("Maria Production staff assignment boundary", () => {
  it("rejects Maria Production staff assignment before SQL or any writes", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(assignStaffToBooking(
      "00000000-0000-4000-8000-000000000010",
      "00000000-0000-4000-8000-000000000020",
    )).rejects.toThrow("Maria booking assignments are disabled in Production");
    expect(fixture.openedSqlClients).toBe(0);
  });

  it.each(["preview", "production"])(
    "preserves the generic staff writer for other workspaces in %s",
    async (env) => {
      vi.stubEnv("VERCEL_ENV", env);
      fixture.workspaceSlug = "other-workspace";
      await expect(assignStaffToBooking("synthetic-booking", "synthetic-staff"))
        .rejects.toThrow("Synthetic SQL must not open");
      expect(fixture.openedSqlClients).toBe(1);
    },
  );

  it("does not disable Maria's existing Preview staff assignment writer", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(assignStaffToBooking("synthetic-booking", "synthetic-staff"))
      .rejects.toThrow("Synthetic SQL must not open");
    expect(fixture.openedSqlClients).toBe(1);
  });
});
