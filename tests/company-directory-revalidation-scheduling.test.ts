import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  revalidate: vi.fn(),
}));

vi.mock("@/lib/company-directory-full-revalidation", () => ({
  revalidateAllCompanyDirectoryBatch: mocks.revalidate,
}));

const ENV_KEYS = [
  "CRON_SECRET",
  "COMPANY_DIRECTORY_SYNC_ENABLED",
  "COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

let previousEnv: Record<EnvKey, string | undefined>;

/** Load the route fresh so each test observes the current environment. */
async function loadRoute() {
  vi.resetModules();
  return await import("../src/app/api/cron/company-directory-revalidation/route");
}

/** Restore one environment variable to its exact pre-test value. */
function restoreEnv(key: EnvKey, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("dedicated Company Directory revalidation scheduling", () => {
  beforeEach(() => {
    previousEnv = {
      CRON_SECRET: process.env.CRON_SECRET,
      COMPANY_DIRECTORY_SYNC_ENABLED: process.env.COMPANY_DIRECTORY_SYNC_ENABLED,
      COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED: process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED,
    };

    mocks.revalidate.mockReset();
    mocks.revalidate.mockResolvedValue({
      skipped: false,
      selected: 10,
      refreshed: 10,
      kept: 10,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: 390,
    });
    process.env.CRON_SECRET = "test-secret";
    process.env.COMPANY_DIRECTORY_SYNC_ENABLED = "true";
    process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED = "true";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) restoreEnv(key, previousEnv[key]);
  });

  it("protects the fast revalidation endpoint with CRON_SECRET", async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request("https://example.test/api/cron/company-directory-revalidation"));

    expect(response.status).toBe(401);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("skips when directory sync is disabled", async () => {
    process.env.COMPANY_DIRECTORY_SYNC_ENABLED = "false";
    const { GET } = await loadRoute();
    const response = await GET(new Request(
      "https://example.test/api/cron/company-directory-revalidation",
      { headers: { authorization: "Bearer test-secret" } },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      reason: "Company directory sync is disabled",
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("skips when profile processing is disabled", async () => {
    process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED = "false";
    const { GET } = await loadRoute();
    const response = await GET(new Request(
      "https://example.test/api/cron/company-directory-revalidation",
      { headers: { authorization: "Bearer test-secret" } },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      reason: "Company directory profile processing is disabled",
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("runs only one bounded full-revalidation batch with a shared deadline", async () => {
    const startedAt = 1_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(startedAt);
    try {
      const { GET } = await loadRoute();
      const response = await GET(new Request(
        "https://example.test/api/cron/company-directory-revalidation",
        { headers: { authorization: "Bearer test-secret" } },
      ));

      expect(response.status).toBe(200);
      expect(mocks.revalidate).toHaveBeenCalledTimes(1);
      expect(mocks.revalidate).toHaveBeenCalledWith(10, {
        deadlineAt: startedAt + 55_000,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("returns HTTP 500 when full revalidation rejects", async () => {
    mocks.revalidate.mockRejectedValue(new Error("SCB unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { GET } = await loadRoute();
      const response = await GET(new Request(
        "https://example.test/api/cron/company-directory-revalidation",
        { headers: { authorization: "Bearer test-secret" } },
      ));

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: "SCB unavailable",
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("schedules only the dedicated revalidation endpoint every five minutes away from minute zero", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/company-directory-revalidation.yml"),
      "utf8",
    );

    expect(workflow).toContain('cron: "2-59/5 * * * *"');
    expect(workflow).not.toContain('cron: "*/5 * * * *"');
    expect(workflow).toContain("/api/cron/company-directory-revalidation");
    expect(workflow).toContain('--header "Authorization: Bearer $CRON_SECRET"');
    expect(workflow).toContain('hostname not in {"proffera.se", "www.proffera.se"}');
    expect(workflow).toContain("url.port not in (None, 443)");
    expect(workflow).not.toContain("/api/cron/company-directory-sync");
    expect(workflow).not.toContain("/api/cron/company-directory-official-facts");
    expect(workflow).not.toContain("Booking reminders");
  });
});