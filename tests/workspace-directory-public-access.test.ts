import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getWorkspaceDirectoryPublicAccessForWorkspaces } from "@/lib/workspace-feature-entitlement-db";

const starterWorkspaceId = "11111111-1111-4111-8111-111111111111";
const invalidTrialWorkspaceId = "22222222-2222-4222-8222-222222222222";

describe("batched Directory workspace public access", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
  });

  it("resolves multiple workspaces in one database query and fails closed for an invalid trial plan", async () => {
    const queries: string[] = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(strings.reduce(
        (result, part, index) => result + part + (index < values.length ? String(values[index]) : ""),
        "",
      ));
      return [
        {
          workspace_id: starterWorkspaceId,
          plan_key: "starter",
          plan_status: "active",
          plan_period_end: null,
          feature_key: "online_booking",
          minimum_plan: "starter",
          workspace_enabled: true,
          admin_override_enabled: null,
          trial_status: null,
          trial_ends_at: null,
        },
        {
          workspace_id: starterWorkspaceId,
          plan_key: "starter",
          plan_status: "active",
          plan_period_end: null,
          feature_key: "website_builder",
          minimum_plan: "professional",
          workspace_enabled: true,
          admin_override_enabled: null,
          trial_status: null,
          trial_ends_at: null,
        },
        {
          workspace_id: invalidTrialWorkspaceId,
          plan_key: null,
          plan_status: "trialing",
          plan_period_end: "2099-01-01T00:00:00.000Z",
          feature_key: "online_booking",
          minimum_plan: "starter",
          workspace_enabled: true,
          admin_override_enabled: null,
          trial_status: null,
          trial_ends_at: null,
        },
        {
          workspace_id: invalidTrialWorkspaceId,
          plan_key: null,
          plan_status: "trialing",
          plan_period_end: "2099-01-01T00:00:00.000Z",
          feature_key: "website_builder",
          minimum_plan: "professional",
          workspace_enabled: true,
          admin_override_enabled: null,
          trial_status: null,
          trial_ends_at: null,
        },
      ];
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await getWorkspaceDirectoryPublicAccessForWorkspaces([
      starterWorkspaceId,
      invalidTrialWorkspaceId,
      starterWorkspaceId,
      "not-a-workspace-id",
    ]);

    expect(sql).toHaveBeenCalledTimes(1);
    expect(queries[0]).toContain("string_to_array");
    expect(queries[0]).toContain("website_builder");
    expect(queries[0]).toContain("online_booking");
    expect(result.get(starterWorkspaceId)).toEqual({
      planAccess: true,
      websiteBuilder: false,
      onlineBooking: true,
    });
    expect(result.get(invalidTrialWorkspaceId)).toEqual({
      planAccess: false,
      websiteBuilder: false,
      onlineBooking: false,
    });
    expect(result.has("not-a-workspace-id")).toBe(false);
  });

  it("fails closed for every requested workspace when the batch query errors", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => {
      throw new Error("database unavailable");
    }));

    const result = await getWorkspaceDirectoryPublicAccessForWorkspaces([
      starterWorkspaceId,
      invalidTrialWorkspaceId,
    ]);

    expect(result.get(starterWorkspaceId)).toEqual({
      planAccess: false,
      websiteBuilder: false,
      onlineBooking: false,
    });
    expect(result.get(invalidTrialWorkspaceId)).toEqual({
      planAccess: false,
      websiteBuilder: false,
      onlineBooking: false,
    });
  });
});
