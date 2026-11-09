import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ slug: "makeup-by-maria", sqlCalls: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic.invalid/isolated",
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    return () => {
      fixture.sqlCalls += 1;
      throw new Error("Synthetic SQL must not execute");
    };
  },
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceSlug: fixture.slug,
    workspaceId: "00000000-0000-4000-8000-000000000001", role: "owner",
  }),
  canManageWorkspaceSettings: () => true,
}));

import { createDashboardBooking, type CreateDashboardBookingInput } from "./dashboard-db";
import { updateDashboardBookingStatus } from "./dashboard-booking-status";

const input: CreateDashboardBookingInput = {
  customerId: "00000000-0000-4000-8000-000000000002",
  title: "Synthetic booking", status: "requested",
  startsAt: "2026-11-20T08:00:00Z", endsAt: "2026-11-20T09:00:00Z",
  city: "", service: "", serviceCategorySlug: "", serviceSlug: "", notes: "",
};

describe("Maria Production manual booking safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    fixture.slug = "makeup-by-maria";
    fixture.sqlCalls = 0;
  });

  it("rejects Maria Production booking creation before any SQL query", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(createDashboardBooking(input))
      .rejects.toThrow("Maria manual booking creation is disabled in Production");
    expect(fixture.sqlCalls).toBe(0);
  });

  it.each(["preview", "production"])(
    "preserves the generic booking writer for an unrelated workspace in %s",
    async (env) => {
      vi.stubEnv("VERCEL_ENV", env);
      fixture.slug = "unrelated-workspace";
      await expect(createDashboardBooking(input)).rejects.toThrow("Synthetic SQL must not execute");
      expect(fixture.sqlCalls).toBe(1);
    },
  );

  it("rejects Maria Production confirmation without Swish authorization before any SQL query", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(updateDashboardBookingStatus("synthetic-booking", "confirmed"))
      .rejects.toThrow("Maria Swish deposit email is not authorized in Production");
    expect(fixture.sqlCalls).toBe(0);
  });

  it("preserves unrelated tenants' Production status writer", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    fixture.slug = "unrelated-workspace";
    await expect(updateDashboardBookingStatus("synthetic-booking", "confirmed"))
      .rejects.toThrow("Synthetic SQL must not execute");
    expect(fixture.sqlCalls).toBe(1);
  });

  it("preserves the locked Maria Preview writer", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(createDashboardBooking(input)).rejects.toThrow("Synthetic SQL must not execute");
    expect(fixture.sqlCalls).toBe(1);
  });
});
