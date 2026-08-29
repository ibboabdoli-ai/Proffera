import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadRoute() {
  vi.resetModules();
  return await import("../src/app/api/cron/operations/route");
}

function request(secret: string, url = "https://www.proffera.se/api/cron/operations") {
  return new Request(url, {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("Operations scheduler route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = "internal-cron-secret";
    process.env.PRODUCTION_SCHEDULER_SECRET = "qstash-scheduler-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("fails closed before dispatching child jobs when authorization is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(request("wrong-secret"));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an authorized request on a non-canonical host before forwarding CRON_SECRET", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(request(
      "qstash-scheduler-secret",
      "https://attacker.example/api/cron/operations",
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid scheduler origin",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the scoped external scheduler secret and keeps CRON_SECRET internal", async () => {
    const calls: Array<{ url: string; authorization: string | null; userAgent: string | null }> = [];
    const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        authorization: headers.get("authorization"),
        userAgent: headers.get("user-agent"),
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(request("qstash-scheduler-secret"));

    expect(response.status).toBe(200);
    expect(calls.map((call) => call.url)).toEqual([
      "https://www.proffera.se/api/cron/booking-reminders",
      "https://www.proffera.se/api/cron/company-directory-official-facts?limit=10",
      "https://www.proffera.se/api/cron/company-directory-sync",
    ]);
    expect(calls.every((call) => call.authorization === "Bearer internal-cron-secret")).toBe(true);
    expect(calls.every((call) => call.userAgent === "proffera-qstash-operations-scheduler")).toBe(true);
  });

  it("preserves CRON_SECRET authorization for GitHub/manual recovery", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const { GET } = await loadRoute();

    const response = await GET(request("internal-cron-secret"));

    expect(response.status).toBe(200);
  });

  it("fails closed when the external request is authorized but the child credential is unavailable", async () => {
    delete process.env.CRON_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(request("qstash-scheduler-secret"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Scheduler child credential unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports partial failure after attempting the remaining bounded child jobs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(request("qstash-scheduler-secret"));

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      results: [
        { name: "booking_reminders", ok: true, status: 200 },
        { name: "company_directory_official_facts", ok: false, status: 503 },
        { name: "company_directory_sync", ok: true, status: 200 },
      ],
    });
  });
});
