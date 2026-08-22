import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-access", () => ({ getUserWorkspaceAccess: mocks.getUserWorkspaceAccess }));

import { getWorkspaceMarketplaceHistory } from "@/lib/workspace-marketplace-history";

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? []);
}

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("claimed workspace Marketplace history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserWorkspaceAccess.mockResolvedValue({ ok: true, workspaceId: "11111111-1111-4111-8111-111111111111" });
  });

  it("resolves pre-claim jobs and reputation through the current claimed workspace", async () => {
    const sql = sqlResponses(
      [{
        id: "22222222-2222-4222-8222-222222222222",
        status: "completed",
        service_name: "Rörmokare",
        city: "Södertälje",
        amount_minor: 150000,
        currency: "SEK",
        created_at: "2026-08-22T12:00:00Z",
      }],
      [{
        profile_id: "33333333-3333-4333-8333-333333333333",
        rating: 4.8,
        verified_review_count: 5,
        completed_jobs: 7,
        provider_cancelled_jobs: 1,
        customer_cancelled_jobs: 0,
        no_show_jobs: 0,
        problem_jobs: 1,
      }],
    );
    mocks.getSql.mockReturnValue(sql);

    const result = await getWorkspaceMarketplaceHistory();

    expect(result.jobs).toHaveLength(1);
    expect(result.reputation).toMatchObject({ rating: 4.8, verifiedReviews: 5, completedJobs: 7 });
    expect(queryText(sql.mock.calls[0])).toContain("marketplace_workspace_service_jobs");
    expect(queryText(sql.mock.calls[0])).toContain("resolved_workspace_id =");
    expect(queryText(sql.mock.calls[1])).toContain("marketplace_workspace_profile_reputation");
  });

  it("fails closed before the bridge migration exists", async () => {
    const missing = Object.assign(new Error("missing relation"), { code: "42P01" });
    mocks.getSql.mockReturnValue(vi.fn().mockRejectedValue(missing));

    await expect(getWorkspaceMarketplaceHistory()).resolves.toEqual({ jobs: [], reputation: null });
  });
});
