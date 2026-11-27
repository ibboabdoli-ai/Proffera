import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  slug: "makeup-by-maria",
  sqlCalls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic.invalid/isolated",
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => () => {
    fixture.sqlCalls += 1;
    throw new Error("Synthetic SQL must not execute");
  },
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true,
    workspaceSlug: fixture.slug,
    workspaceId: "00000000-0000-4000-8000-000000000001",
    role: "owner",
    userId: "synthetic-owner",
  }),
  canManageWorkspaceSettings: () => true,
}));
vi.mock("@/lib/verified-review-email-delivery", () => ({
  deliverVerifiedReviewInvitation: vi.fn(),
}));

import {
  addDashboardWorkspaceServiceJobNote,
  assignDashboardWorkspaceServiceJob,
  transitionDashboardWorkspaceServiceJob,
} from "./workspace-service-jobs-db";
import { deliverVerifiedReviewInvitation } from "@/lib/verified-review-email-delivery";

const jobId = "00000000-0000-4000-8000-000000000002";
const staffId = "00000000-0000-4000-8000-000000000003";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  fixture.slug = "makeup-by-maria";
  fixture.sqlCalls = 0;
});

describe("Maria Production service-job mutation boundary", () => {
  it("rejects status transitions before SQL and email delivery", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    for (const status of ["completed", "cancelled", "in_progress"] as const) {
      await expect(transitionDashboardWorkspaceServiceJob(jobId, status, "Synthetic QA completion"))
        .rejects.toThrow("Maria service job changes are disabled in Production");
    }
    expect(fixture.sqlCalls).toBe(0);
    expect(deliverVerifiedReviewInvitation).not.toHaveBeenCalled();
  });

  it("rejects staff assignment and notes before SQL", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(assignDashboardWorkspaceServiceJob(jobId, staffId))
      .rejects.toThrow("Maria service job changes are disabled in Production");
    await expect(addDashboardWorkspaceServiceJobNote(jobId, "Synthetic QA note"))
      .rejects.toThrow("Maria service job changes are disabled in Production");
    expect(fixture.sqlCalls).toBe(0);
    expect(deliverVerifiedReviewInvitation).not.toHaveBeenCalled();
  });

  it.each(["preview", "production"])(
    "keeps unrelated workspace job writers unchanged in %s",
    async (env) => {
      vi.stubEnv("VERCEL_ENV", env);
      fixture.slug = "other-workspace";
      await expect(transitionDashboardWorkspaceServiceJob(jobId, "completed", "Synthetic QA completion"))
        .rejects.toThrow("Synthetic SQL must not execute");
      await expect(assignDashboardWorkspaceServiceJob(jobId, staffId))
        .rejects.toThrow("Synthetic SQL must not execute");
      await expect(addDashboardWorkspaceServiceJobNote(jobId, "Synthetic QA note"))
        .rejects.toThrow("Synthetic SQL must not execute");
      expect(fixture.sqlCalls).toBe(3);
      expect(deliverVerifiedReviewInvitation).not.toHaveBeenCalled();
    },
  );

  it("preserves Maria Preview's protected service-job writers", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(transitionDashboardWorkspaceServiceJob(jobId, "completed", "Synthetic QA completion"))
      .rejects.toThrow("Synthetic SQL must not execute");
    expect(fixture.sqlCalls).toBe(1);
    expect(deliverVerifiedReviewInvitation).not.toHaveBeenCalled();
  });
});
