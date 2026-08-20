import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  revalidate: vi.fn(),
}));

vi.mock("@/lib/company-directory-full-revalidation", () => ({
  revalidateAllCompanyDirectoryBatch: mocks.revalidate,
}));

async function loadRoute() {
  vi.resetModules();
  return await import("../src/app/api/cron/company-directory-revalidation/route");
}

describe("dedicated Company Directory revalidation scheduling", () => {
  beforeEach(() => {
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
    delete process.env.CRON_SECRET;
    delete process.env.COMPANY_DIRECTORY_SYNC_ENABLED;
    delete process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED;
  });

  it("protects the fast revalidation endpoint with CRON_SECRET", async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request("https://example.test/api/cron/company-directory-revalidation"));

    expect(response.status).toBe(401);
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

  it("schedules only the dedicated revalidation endpoint every five minutes", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/company-directory-revalidation.yml"),
      "utf8",
    );

    expect(workflow).toContain('cron: "*/5 * * * *"');
    expect(workflow).toContain("/api/cron/company-directory-revalidation");
    expect(workflow).not.toContain("/api/cron/company-directory-sync");
    expect(workflow).not.toContain("/api/cron/company-directory-official-facts");
    expect(workflow).not.toContain("Booking reminders");
  });
});
