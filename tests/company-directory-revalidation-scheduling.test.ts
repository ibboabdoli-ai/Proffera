import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION } from "../src/lib/company-directory-category-confidence";

const mocks = vi.hoisted(() => ({
  revalidatePolicy: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/company-directory-category-policy-revalidation", () => ({
  revalidateCompanyDirectoryCategoryPolicyBatch: mocks.revalidatePolicy,
}));
vi.mock("@/lib/company-directory-full-revalidation", () => ({
  revalidateAllCompanyDirectoryBatch: mocks.revalidate,
}));

const ENV_KEYS = [
  "CRON_SECRET",
  "COMPANY_DIRECTORY_REVALIDATION_SCHEDULER_SECRET",
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

/** Return whether a cron minute field schedules the requested minute. */
function cronMinuteFieldIncludes(minuteField: string, minute: number) {
  return minuteField.split(",").some((part) => {
    const [base, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step <= 0) return false;

    if (base === "*") return minute % step === 0;

    const [startText, endText] = base.split("-");
    const start = Number(startText);
    if (!Number.isInteger(start)) return false;
    if (endText === undefined) return start === minute;

    const end = Number(endText);
    if (!Number.isInteger(end) || minute < start || minute > end) return false;
    return (minute - start) % step === 0;
  });
}

/** Assert that every cron expression in a workflow avoids the dedicated revalidation minutes. */
function expectNoRevalidationMinuteCollision(workflow: string) {
  const minuteFields = [...workflow.matchAll(/cron:\s*"([^"]+)"/g)].map((match) =>
    match[1].trim().split(/\s+/)[0]
  );

  expect(minuteFields.length).toBeGreaterThan(0);
  for (const minuteField of minuteFields) {
    expect(cronMinuteFieldIncludes(minuteField, 14)).toBe(false);
    expect(cronMinuteFieldIncludes(minuteField, 44)).toBe(false);
  }
}

describe("dedicated Company Directory revalidation scheduling", () => {
  beforeEach(() => {
    previousEnv = {
      CRON_SECRET: process.env.CRON_SECRET,
      COMPANY_DIRECTORY_REVALIDATION_SCHEDULER_SECRET:
        process.env.COMPANY_DIRECTORY_REVALIDATION_SCHEDULER_SECRET,
      COMPANY_DIRECTORY_SYNC_ENABLED: process.env.COMPANY_DIRECTORY_SYNC_ENABLED,
      COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED:
        process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED,
    };

    mocks.revalidatePolicy.mockReset();
    mocks.revalidate.mockReset();
    mocks.revalidatePolicy.mockResolvedValue({
      policyVersion: "2026-08-23.1",
      selected: 10,
      evaluated: 10,
      kept: 10,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: 745,
    });
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
    delete process.env.COMPANY_DIRECTORY_REVALIDATION_SCHEDULER_SECRET;
    process.env.COMPANY_DIRECTORY_SYNC_ENABLED = "true";
    process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED = "true";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) restoreEnv(key, previousEnv[key]);
  });

  it("protects the fast revalidation endpoint with an authorized scheduler secret", async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request("https://example.test/api/cron/company-directory-revalidation"));

    expect(response.status).toBe(401);
    expect(mocks.revalidatePolicy).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("continues to accept the existing CRON_SECRET", async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request(
      "https://example.test/api/cron/company-directory-revalidation",
      { headers: { authorization: "Bearer test-secret" } },
    ));

    expect(response.status).toBe(200);
    expect(mocks.revalidatePolicy).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("accepts a dedicated external scheduler secret without exposing CRON_SECRET", async () => {
    delete process.env.CRON_SECRET;
    process.env.COMPANY_DIRECTORY_REVALIDATION_SCHEDULER_SECRET = "external-scheduler-secret";

    const { GET } = await loadRoute();
    const response = await GET(new Request(
      "https://example.test/api/cron/company-directory-revalidation",
      { headers: { authorization: "Bearer external-scheduler-secret" } },
    ));

    expect(response.status).toBe(200);
    expect(mocks.revalidatePolicy).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("rejects an incorrect external scheduler secret", async () => {
    process.env.COMPANY_DIRECTORY_REVALIDATION_SCHEDULER_SECRET = "external-scheduler-secret";

    const { GET } = await loadRoute();
    const response = await GET(new Request(
      "https://example.test/api/cron/company-directory-revalidation",
      { headers: { authorization: "Bearer wrong-secret" } },
    ));

    expect(response.status).toBe(401);
    expect(mocks.revalidatePolicy).not.toHaveBeenCalled();
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
    expect(mocks.revalidatePolicy).not.toHaveBeenCalled();
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
    expect(mocks.revalidatePolicy).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("runs one bounded policy sweep before one bounded full-revalidation batch", async () => {
    const startedAt = 1_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(startedAt);
    try {
      const order: string[] = [];
      mocks.revalidatePolicy.mockImplementation(async () => {
        order.push("policy");
        return {
          policyVersion: "2026-08-23.1",
          selected: 0,
          evaluated: 0,
          kept: 0,
          movedToReview: 0,
          deferred: 0,
          errors: 0,
          errorSummary: "",
          remaining: 0,
        };
      });
      mocks.revalidate.mockImplementation(async () => {
        order.push("full");
        return {
          skipped: false,
          selected: 0,
          refreshed: 0,
          kept: 0,
          movedToReview: 0,
          deferred: 0,
          errors: 0,
          errorSummary: "",
          remaining: 0,
        };
      });

      const { GET } = await loadRoute();
      const response = await GET(new Request(
        "https://example.test/api/cron/company-directory-revalidation",
        { headers: { authorization: "Bearer test-secret" } },
      ));

      expect(response.status).toBe(200);
      expect(order).toEqual(["policy", "full"]);
      expect(mocks.revalidatePolicy).toHaveBeenCalledWith(10, {
        deadlineAt: startedAt + 55_000,
      });
      expect(mocks.revalidate).toHaveBeenCalledWith(10, {
        deadlineAt: startedAt + 55_000,
      });
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        policyEvaluation: {
          policyVersion: "2026-08-23.1",
        },
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("reports a policy sweep failure but still runs the existing full revalidation", async () => {
    mocks.revalidatePolicy.mockRejectedValue(new Error("Policy sweep unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { GET } = await loadRoute();
      const response = await GET(new Request(
        "https://example.test/api/cron/company-directory-revalidation",
        { headers: { authorization: "Bearer test-secret" } },
      ));

      expect(response.status).toBe(200);
      expect(mocks.revalidate).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        policyEvaluation: {
          policyVersion: COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION,
          skipped: true,
          reason: "worker_error",
          errors: 1,
          errorSummary: "Policy sweep unavailable",
          remaining: null,
        },
      });
    } finally {
      errorSpy.mockRestore();
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

  it("keeps GitHub as a manual fallback while automatic full revalidation stays out of Operations", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/company-directory-revalidation.yml"),
      "utf8",
    );
    const operationsWorkflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/booking-reminders.yml"),
      "utf8",
    );
    const operationsRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/cron/company-directory-sync/route.ts"),
      "utf8",
    );
    const marketplaceWorkflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/marketplace-auto-worker.yml"),
      "utf8",
    );
    const productionHealthWorkflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/production-health.yml"),
      "utf8",
    );
    const directoryAutomationWorkflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/company-directory-automation.yml"),
      "utf8",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("schedule:");
    expect(workflow).not.toContain("cron:");
    expect(workflow).not.toContain("BATCHES_PER_RUN=2");
    expect(workflow).not.toContain('for batch in $(seq 1 "$BATCHES_PER_RUN")');
    expect(operationsWorkflow).toContain('cron: "8,23,38,53 * * * *"');
    expect(marketplaceWorkflow).toContain('cron: "11,26,41,56 * * * *"');
    expect(productionHealthWorkflow).toContain('cron: "7,37 * * * *"');
    expect(directoryAutomationWorkflow).toContain('cron: "17 * * * *"');
    expect(directoryAutomationWorkflow).toContain('cron: "31 3 * * *"');
    for (const otherWorkflow of [
      operationsWorkflow,
      marketplaceWorkflow,
      productionHealthWorkflow,
      directoryAutomationWorkflow,
    ]) {
      expectNoRevalidationMinuteCollision(otherWorkflow);
    }
    expect(workflow.match(/\/api\/cron\/company-directory-revalidation/g) ?? []).toHaveLength(1);
    expect(workflow).toContain("--connect-timeout 10");
    expect(workflow).toContain("--max-time 75");
    expect(workflow).toContain('--header "Authorization: Bearer $CRON_SECRET"');
    expect(workflow).toContain('hostname not in {"proffera.se", "www.proffera.se"}');
    expect(workflow).toContain("url.port not in (None, 443)");
    expect(workflow).not.toContain("/api/cron/company-directory-sync");
    expect(workflow).not.toContain("/api/cron/company-directory-official-facts");
    expect(workflow).not.toContain("Booking reminders");
    expect(operationsWorkflow).toContain("/api/cron/company-directory-sync");
    expect(operationsWorkflow).not.toContain("/api/cron/company-directory-revalidation");
    expect(operationsRoute).not.toContain("revalidateAllCompanyDirectoryBatch");
    expect(operationsRoute).not.toContain("fullRevalidation");
    expect(operationsRoute).toContain("revalidatePublishedCompanyDirectoryBatch");
  });
});
