import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ slug: "makeup-by-maria", sqlClients: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic.invalid/isolated",
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    fixture.sqlClients += 1;
    throw new Error("Synthetic SQL must not open");
  },
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceSlug: fixture.slug,
    workspaceId: "00000000-0000-4000-8000-000000000001", role: "owner",
  }),
  canManageWorkspaceSettings: () => true,
}));

import {
  createDashboardAvailabilityBlock,
  createDashboardRecurringAvailabilityBlocks,
} from "./dashboard-availability-blocks";
import { deleteDashboardAvailabilityBlock } from "./dashboard-availability-management";

const single = { localStartsAt: "2026-11-20T08:00", localEndsAt: "2026-11-20T09:00", reason: "QA" };
const recurring = {
  startDate: "2026-11-20", endDate: "2026-11-27",
  startTime: "08:00", endTime: "09:00", weekdays: [5], reason: "QA",
};

describe("Maria Production availability block safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    fixture.slug = "makeup-by-maria";
    fixture.sqlClients = 0;
  });

  it("rejects both single and recurring Maria blocks before opening SQL", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(createDashboardAvailabilityBlock(single))
      .rejects.toThrow("Maria availability blocks are disabled in Production");
    await expect(createDashboardRecurringAvailabilityBlocks(recurring))
      .rejects.toThrow("Maria availability blocks are disabled in Production");
    expect(fixture.sqlClients).toBe(0);
  });

  it.each(["preview", "production"])(
    "keeps unrelated workspaces on the existing generic writer in %s",
    async (env) => {
      vi.stubEnv("VERCEL_ENV", env);
      fixture.slug = "unrelated-workspace";
      await expect(createDashboardAvailabilityBlock(single)).rejects.toThrow("Synthetic SQL must not open");
      await expect(createDashboardRecurringAvailabilityBlocks(recurring)).rejects.toThrow("Synthetic SQL must not open");
      expect(fixture.sqlClients).toBe(2);
    },
  );

  it("refuses Maria Production block deletion before opening SQL", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(deleteDashboardAvailabilityBlock("synthetic-block"))
      .rejects.toThrow("Maria availability block deletion is disabled in Production");
    expect(fixture.sqlClients).toBe(0);
  });

  it.each(["preview", "production"])(
    "preserves generic block deletion for unrelated workspaces in %s",
    async (env) => {
      vi.stubEnv("VERCEL_ENV", env);
      fixture.slug = "unrelated-workspace";
      await expect(deleteDashboardAvailabilityBlock("synthetic-block"))
        .rejects.toThrow("Synthetic SQL must not open");
      expect(fixture.sqlClients).toBe(1);
    },
  );

  it("does not disable Maria Preview's authorized blocking path", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(createDashboardAvailabilityBlock(single)).rejects.toThrow("Synthetic SQL must not open");
    expect(fixture.sqlClients).toBe(1);
  });
});
