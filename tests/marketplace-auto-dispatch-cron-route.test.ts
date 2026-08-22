import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runWorker: vi.fn(),
}));

vi.mock("@/lib/marketplace-auto-dispatch-worker", () => ({
  runMarketplaceAutoDispatch: mocks.runWorker,
}));

import { GET, POST } from "@/app/api/cron/marketplace-auto-dispatch/route";

function request(method: "GET" | "POST", authorization = "Bearer test-secret") {
  return new Request("https://www.proffera.se/api/cron/marketplace-auto-dispatch", {
    method,
    headers: { authorization },
  });
}

describe("Marketplace auto dispatch cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mocks.runWorker.mockResolvedValue({
      ok: true,
      scanned: 1,
      considered: 1,
      attempted: 3,
      sent: 3,
      wave1Sent: 3,
      wave2Sent: 0,
      failures: 0,
      stoppedByDeadline: false,
      skipped: {},
    });
  });

  it("requires the shared cron bearer secret for status and execution", async () => {
    expect((await GET(request("GET", "Bearer wrong"))).status).toBe(401);
    expect((await POST(request("POST", "Bearer wrong"))).status).toBe(401);
    expect(mocks.runWorker).not.toHaveBeenCalled();
  });

  it("runs the worker only on an authorized POST and uses the request HTTPS origin", async () => {
    const response = await POST(request("POST"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, sent: 3 });
    expect(mocks.runWorker).toHaveBeenCalledWith({ baseUrl: "https://www.proffera.se" });
  });

  it("surfaces a fail-closed worker configuration result without pretending success", async () => {
    mocks.runWorker.mockResolvedValueOnce({ ok: false, code: "email_configuration" });

    const response = await POST(request("POST"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "email_configuration" });
  });
});
