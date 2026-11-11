import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  access: vi.fn(), accept: vi.fn(),
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.access,
  canManageWorkspaceMembers: (access: {role: string}) => access.role === "owner",
}));
vi.mock("@/lib/maria-starter-full-price", () => ({
  acceptMariaStarterFullPrice: mocks.accept,
}));
import { POST } from "./route";
const base = { ok: true, role: "owner", workspaceSlug: "makeup-by-maria",
  workspaceId: "11111111-1111-4111-8111-111111111111", userId: "synthetic-owner" };
function request(payload: Record<string, unknown>, origin = "https://example.test") {
  return new Request("https://example.test/api/stripe/starter-full-price", {
    method: "POST", headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
const approved = {
  subscriptionId: "sub_synthetic", discountId: "di_synthetic",
  periodEnd: 1900000000, nextAmountOre: 29900,
  acknowledged: true, confirmation: "CONFIRM 299 SEK",
};
describe("Maria Starter explicit price approval route", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.access.mockResolvedValue(base);
    mocks.accept.mockResolvedValue("updated");
  });
  it("requires same-site request and Owner, even if a client supplies a subscription ID", async () => {
    expect((await POST(request(approved,"https://attacker.test"))).status).toBe(403);
    mocks.access.mockResolvedValue({...base,role:"admin"});
    expect((await POST(request(approved))).status).toBe(403);
    mocks.access.mockResolvedValue({...base,workspaceSlug:"other"});
    expect((await POST(request(approved))).status).toBe(403);
    expect(mocks.accept).not.toHaveBeenCalled();
  });
  it("rejects unapproved or altered recurring price and retains server workspace identity", async () => {
    expect((await POST(request({...approved, acknowledged:false}))).status).toBe(400);
    expect((await POST(request({...approved,nextAmountOre:15000}))).status).toBe(400);
    expect(mocks.accept).not.toHaveBeenCalled();
    const response=await POST(request(approved));
    expect(response.status).toBe(200);
    expect(mocks.accept).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId:base.workspaceId,userId:base.userId,subscriptionId:"sub_synthetic",nextAmountOre:29900,
    }));
  });
  it("never reports success when the Stripe quote has changed", async () => {
    mocks.accept.mockResolvedValue("stale");
    expect((await POST(request(approved))).status).toBe(409);
  });
});
