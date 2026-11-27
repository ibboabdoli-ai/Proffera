import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getWorkspaceSmsUsage } from "./workspace-sms-usage";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const current = {
  status: "active",
  plan_key: "starter",
  plan_status: "active",
  sms_monthly_limit: 50,
  current_period_end: new Date(Date.now()+1000*3600*24*28).toISOString(),
  plan_end: new Date(Date.now()+1000*3600*24*28).toISOString(),
  workspace_slug: "makeup-by-maria",
  used: 3,
};
beforeEach(() => {
  mocks.getSql.mockReset();
  mocks.sql.mockReset();
  mocks.getSql.mockReturnValue(mocks.sql);
});
describe("Maria-only Starter SMS usage display", () => {
  it("shows verified paid period remaining units for Maria", async () => {
    mocks.sql.mockResolvedValue([{ ...current }]);
    expect(await getWorkspaceSmsUsage(workspaceId)).toMatchObject({
      active:true, available:true, limit:50, used:3, remaining:47,
    });
  });
  it("never advertises Starter SMS quota for another Workspace", async () => {
    mocks.sql.mockResolvedValue([{ ...current, workspace_slug:"unrelated-starter" }]);
    expect(await getWorkspaceSmsUsage(workspaceId)).toMatchObject({
      available:true, limit:null, remaining:0,
    });
  });
});
