import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), change: vi.fn() }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.access,
  canManageWorkspaceMembers: (access: {role: string}) => access.role === "owner",
}));
vi.mock("@/lib/maria-booking-soft-delete", () => ({
  changeMariaBookingSoftDelete: mocks.change,
}));
import { POST } from "./route";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const bookingId = "33333333-3333-4333-8333-333333333333";
const access = { ok:true, role:"owner", workspaceSlug:"makeup-by-maria",
  workspaceId, userId:"synthetic-owner" };
const payload = { bookingId, action:"hide", confirmation:bookingId, acknowledged:true };
function request(body: Record<string, unknown>, origin="https://example.test") {
  return new Request("https://example.test/api/dashboard/bokningar/soft-delete", {
    method:"POST", headers: { origin, "Content-Type":"application/json" }, body:JSON.stringify(body),
  });
}
describe("Owner-only Maria reversible booking archive API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue(access); mocks.change.mockResolvedValue("updated"); });
  it("rejects CSRF, admin role and cross-workspace identity", async () => {
    expect((await POST(request(payload,"https://attacker.test"))).status).toBe(403);
    mocks.access.mockResolvedValue({...access,role:"admin"});
    expect((await POST(request(payload))).status).toBe(403);
    mocks.access.mockResolvedValue({...access,workspaceSlug:"other-workspace"});
    expect((await POST(request(payload))).status).toBe(403);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("requires the exact booking UUID typed and a separate acknowledgement", async () => {
    expect((await POST(request({...payload,confirmation:"DELETE"}))).status).toBe(400);
    expect((await POST(request({...payload,acknowledged:false}))).status).toBe(400);
    expect((await POST(request({...payload,action:"hard-delete"}))).status).toBe(400);
    expect((await POST(request(payload))).status).toBe(200);
    expect(mocks.change).toHaveBeenCalledWith({
      workspaceId,bookingId,actorId:"synthetic-owner",action:"hide",
    });
  });
  it("allows restoration but does not invent a successful mutation", async () => {
    expect((await POST(request({...payload,action:"restore"}))).status).toBe(200);
    mocks.change.mockResolvedValue("unchanged");
    expect((await POST(request(payload))).status).toBe(409);
  });
});
