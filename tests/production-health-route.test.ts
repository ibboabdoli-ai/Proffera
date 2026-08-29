import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readHealth: vi.fn() }));

vi.mock("@/lib/production-schema-health", () => ({
  readProductionSchemaHealth: mocks.readHealth,
}));

import { GET } from "@/app/api/cron/production-health/route";

const originalEnv = { ...process.env };

function request(secret = "cron-secret") {
  return new Request("https://www.proffera.se/api/cron/production-health", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

const healthySchema = {
  ok: true,
  databaseReachable: true,
  ledgerPresent: true,
  workspaceServiceIdentity: {
    columnPresent: true,
    foreignKeyValidated: true,
    indexPresent: true,
  },
  requiredMigrations: ["20260823_0065", "20260823_0066"],
  appliedMigrations: ["20260823_0065", "20260823_0066"],
  missingMigrations: [],
};

describe("Production health cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    process.env.PRODUCTION_SCHEDULER_SECRET = "qstash-secret";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_GIT_COMMIT_SHA = "1111111111111111111111111111111111111111";
    mocks.readHealth.mockResolvedValue(healthySchema);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires an authorized scheduler secret before touching the database", async () => {
    expect((await GET(request("wrong"))).status).toBe(401);
    expect(mocks.readHealth).not.toHaveBeenCalled();

    delete process.env.CRON_SECRET;
    delete process.env.PRODUCTION_SCHEDULER_SECRET;
    expect((await GET(request())).status).toBe(401);
    expect(mocks.readHealth).not.toHaveBeenCalled();
  });

  it("accepts the scoped external scheduler secret without CRON_SECRET", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(request("qstash-secret"));

    expect(response.status).toBe(200);
    expect(mocks.readHealth).toHaveBeenCalledTimes(1);
  });

  it("reports the exact deployed commit for a healthy Production schema", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      environment: "production",
      commit: "1111111111111111111111111111111111111111",
      schema: { ok: true, missingMigrations: [] },
    });
  });

  it("fails closed outside Production even when the database schema is healthy", async () => {
    process.env.VERCEL_ENV = "preview";

    const response = await GET(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, environment: "preview" });
  });

  it("fails closed when the schema health contract fails", async () => {
    mocks.readHealth.mockResolvedValue({
      ...healthySchema,
      ok: false,
      missingMigrations: ["20260823_0066"],
    });

    const response = await GET(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      schema: { ok: false, missingMigrations: ["20260823_0066"] },
    });
  });
});
