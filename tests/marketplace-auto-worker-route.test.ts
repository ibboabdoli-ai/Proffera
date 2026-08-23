import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ processWorker: vi.fn() }));

vi.mock("@/lib/marketplace-auto-worker", () => ({
  DEFAULT_MARKETPLACE_WAVE2_DELAY_MS: 6 * 60 * 60 * 1000,
  processMarketplaceAutoWorker: mocks.processWorker,
}));

import { GET } from "@/app/api/cron/marketplace-auto-worker/route";

const originalEnv = { ...process.env };

function request(secret = "cron-secret") {
  return new Request("https://preview.proffera.test/api/cron/marketplace-auto-worker", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("Marketplace Auto Worker cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    process.env.MARKETPLACE_AUTO_WORKER_ENABLED = "true";
    process.env.VERCEL_ENV = "preview";
    process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE = "2026-08-23T09:24:45.000Z";
    delete process.env.MARKETPLACE_AUTO_WORKER_ALLOW_PRODUCTION;
    delete process.env.MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES;
    delete process.env.MARKETPLACE_AUTO_WORKER_BATCH_SIZE;
    mocks.processWorker.mockResolvedValue({ ok: true, scanned: 1, attempted: 1, sent: 1 });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires the scheduler secret, including when the server secret is missing", async () => {
    expect((await GET(request("wrong"))).status).toBe(401);
    expect(mocks.processWorker).not.toHaveBeenCalled();

    delete process.env.CRON_SECRET;
    expect((await GET(request())).status).toBe(401);
    expect(mocks.processWorker).not.toHaveBeenCalled();
  });

  it("is dormant unless explicitly enabled", async () => {
    process.env.MARKETPLACE_AUTO_WORKER_ENABLED = "false";

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, skipped: "disabled" });
    expect(mocks.processWorker).not.toHaveBeenCalled();
  });

  it("refuses Production writes without the separate Production authorization flag", async () => {
    process.env.VERCEL_ENV = "production";

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, skipped: "production_not_authorized" });
    expect(mocks.processWorker).not.toHaveBeenCalled();
  });

  it("refuses Production writes without a valid rollout cutoff", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.MARKETPLACE_AUTO_WORKER_ALLOW_PRODUCTION = "true";
    delete process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE;

    let response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, skipped: "production_cutoff_not_configured" });
    expect(mocks.processWorker).not.toHaveBeenCalled();

    process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE = "not-a-date";
    response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, skipped: "production_cutoff_not_configured" });
    expect(mocks.processWorker).not.toHaveBeenCalled();
  });

  it("runs in Preview and passes bounded scheduling controls", async () => {
    process.env.MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES = "120";
    process.env.MARKETPLACE_AUTO_WORKER_BATCH_SIZE = "3";

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.processWorker).toHaveBeenCalledWith({
      baseUrl: "https://preview.proffera.test",
      batchSize: 3,
      wave2DelayMs: 120 * 60_000,
    });
  });

  it("uses safe defaults for empty scheduling settings", async () => {
    process.env.MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES = "   ";
    process.env.MARKETPLACE_AUTO_WORKER_BATCH_SIZE = "";

    await GET(request());

    expect(mocks.processWorker).toHaveBeenCalledWith({
      baseUrl: "https://preview.proffera.test",
      batchSize: 5,
      wave2DelayMs: 360 * 60_000,
    });
  });

  it("clamps low and high scheduling settings", async () => {
    process.env.MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES = "5";
    process.env.MARKETPLACE_AUTO_WORKER_BATCH_SIZE = "0";
    await GET(request());
    expect(mocks.processWorker).toHaveBeenLastCalledWith({
      baseUrl: "https://preview.proffera.test",
      batchSize: 1,
      wave2DelayMs: 15 * 60_000,
    });

    mocks.processWorker.mockClear();
    process.env.MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES = "5000";
    process.env.MARKETPLACE_AUTO_WORKER_BATCH_SIZE = "99";
    await GET(request());
    expect(mocks.processWorker).toHaveBeenLastCalledWith({
      baseUrl: "https://preview.proffera.test",
      batchSize: 10,
      wave2DelayMs: 24 * 60 * 60_000,
    });
  });

  it("keeps Production opt-in separate from general enablement", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.MARKETPLACE_AUTO_WORKER_ALLOW_PRODUCTION = "true";

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.processWorker).toHaveBeenCalledTimes(1);
  });

  it("returns a failure status when the worker fails closed", async () => {
    mocks.processWorker.mockResolvedValue({ ok: false, error: "email_configuration" });

    const response = await GET(request());

    expect(response.status).toBe(503);
  });
});
