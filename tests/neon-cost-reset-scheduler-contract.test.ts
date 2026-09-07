import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { workflowCronExpressions, workflowTriggers } from "./github-workflow-yaml";

const originalEnv = { ...process.env };

const mocks = vi.hoisted(() => ({
  processBookingReminders: vi.fn(),
  enrichCompanyDirectoryOfficialFacts: vi.fn(),
  processCompanyDirectoryDiscoveryQueue: vi.fn(),
  processNewCompanyDirectoryDiscoveryQueueBatch: vi.fn(),
  syncCompanyDirectory: vi.fn(),
  revalidatePublishedCompanyDirectoryBatch: vi.fn(),
  autoPublishReadyHighConfidenceCompanyDirectoryBatch: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/booking-reminders", () => ({ processBookingReminders: mocks.processBookingReminders }));
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFacts: mocks.enrichCompanyDirectoryOfficialFacts,
}));
vi.mock("@/lib/company-directory-discovery-queue", () => ({
  processCompanyDirectoryDiscoveryQueue: mocks.processCompanyDirectoryDiscoveryQueue,
  processNewCompanyDirectoryDiscoveryQueueBatch: mocks.processNewCompanyDirectoryDiscoveryQueueBatch,
}));
vi.mock("@/lib/company-directory-engine", () => ({ syncCompanyDirectory: mocks.syncCompanyDirectory }));
vi.mock("@/lib/company-directory-published-revalidation", () => ({
  revalidatePublishedCompanyDirectoryBatch: mocks.revalidatePublishedCompanyDirectoryBatch,
}));
vi.mock("@/lib/company-directory-ready-auto-publish", () => ({
  autoPublishReadyHighConfidenceCompanyDirectoryBatch: mocks.autoPublishReadyHighConfidenceCompanyDirectoryBatch,
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function cronMinutes(expression: string) {
  const minuteField = expression.trim().split(/\s+/)[0];
  return new Set(
    minuteField
      .split(",")
      .filter((part) => /^\d+$/.test(part))
      .map(Number),
  );
}

function circularMinuteDistance(a: number, b: number) {
  const direct = Math.abs(a - b);
  return Math.min(direct, 60 - direct);
}

function bookingEligibleAt(reminderDueAtMs: number, runAtMs: number) {
  const oneHourMs = 60 * 60 * 1_000;
  return runAtMs >= reminderDueAtMs && runAtMs < reminderDueAtMs + oneHourMs;
}

function firstEligibleRun(reminderDueAtMs: number, runs: number[]) {
  return runs.find((runAtMs) => bookingEligibleAt(reminderDueAtMs, runAtMs));
}

function halfHourlyRuns(startAtMs: number, count: number) {
  return Array.from({ length: count }, (_, index) => startAtMs + index * 30 * 60 * 1_000);
}

async function loadChildRoutes() {
  vi.resetModules();
  const [booking, officialFacts, directorySync] = await Promise.all([
    import("../src/app/api/cron/booking-reminders/route"),
    import("../src/app/api/cron/company-directory-official-facts/route"),
    import("../src/app/api/cron/company-directory-sync/route"),
  ]);
  return { booking, officialFacts, directorySync };
}

function childRequest(url: string, secret?: string) {
  return new Request(url, {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("Neon cost-reset scheduler contract", () => {
  it("reduces the repository-owned Directory source probe without removing the daily safety scan", () => {
    const discovery = read(".github/workflows/company-directory-automation.yml");

    expect(workflowCronExpressions(discovery)).toEqual(["8 */6 * * *", "31 3 * * *"]);
    expect(discovery).not.toContain('cron: "17 * * * *"');
    expect(discovery).toContain("github.event.schedule == '8 */6 * * *'");
    expect(discovery).toContain('reason="daily-safety-scan"');
  });

  it("keeps QStash-owned recurring jobs out of GitHub scheduling", () => {
    for (const path of [
      ".github/workflows/booking-reminders.yml",
      ".github/workflows/marketplace-auto-worker.yml",
      ".github/workflows/company-directory-revalidation.yml",
    ]) {
      const workflow = read(path);
      const triggers = workflowTriggers(workflow);
      expect(triggers).toHaveProperty("workflow_dispatch");
      expect(triggers).not.toHaveProperty("schedule");
      expect(workflowCronExpressions(workflow)).toEqual([]);
    }

    const health = read(".github/workflows/production-health.yml");
    const healthTriggers = workflowTriggers(health);
    expect(healthTriggers).toHaveProperty("push");
    expect(healthTriggers).toHaveProperty("repository_dispatch");
    expect(healthTriggers).toHaveProperty("workflow_dispatch");
    expect(healthTriggers).not.toHaveProperty("schedule");
    expect(workflowCronExpressions(health)).toEqual([]);
  });

  it("documents the revised external cutover without pretending QStash was changed", () => {
    const contract = read("docs/NEON_COST_RESET_CUTOVER.md");

    expect(contract).toContain("QStash Production mutation performed by this PR: **NO**");
    expect(contract).toContain("Production DB mutation performed by this PR: **NO**");
    expect(contract).toContain("Neon configuration mutation performed by this PR: **NO**");
    expect(contract).toContain("PROPOSED:\nGET /api/cron/company-directory-sync\ncron: 8,23,38,53 * * * *");
    expect(contract).toContain("PROPOSED:\nGET /api/cron/booking-reminders\ncron: 8,38 * * * *");
    expect(contract).toContain("PROPOSED:\nGET /api/cron/company-directory-official-facts?limit=10\ncron: 10 * * * *");
    expect(contract).toContain("GET /api/cron/company-directory-revalidation\nlive runtime: 13,43 * * * *");
    expect(contract).toContain("PROPOSED:\ncron: 12,42 * * * *");
    expect(contract).toContain("PRODUCTION_SCHEDULER_SECRET");
    expect(contract).not.toContain("use `CRON_SECRET` for the direct QStash schedules");
  });

  it("staggers provider-heavy jobs by at least two nominal minutes", () => {
    const schedules = [
      { name: "directory-sync", cron: "8,23,38,53 * * * *" },
      { name: "official-facts", cron: "10 * * * *" },
      { name: "full-revalidation", cron: "12,42 * * * *" },
    ];

    for (let leftIndex = 0; leftIndex < schedules.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < schedules.length; rightIndex += 1) {
        const left = schedules[leftIndex];
        const right = schedules[rightIndex];
        for (const leftMinute of cronMinutes(left.cron)) {
          for (const rightMinute of cronMinutes(right.cron)) {
            expect(
              circularMinuteDistance(leftMinute, rightMinute),
              `${left.name} and ${right.name} are too close`,
            ).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }

    const syncRoute = read("src/app/api/cron/company-directory-sync/route.ts");
    const factsRoute = read("src/app/api/cron/company-directory-official-facts/route.ts");
    const revalidationRoute = read("src/app/api/cron/company-directory-revalidation/route.ts");
    const providerPolicy = read("src/lib/bolagsverket-api-policy.ts");

    expect(syncRoute).toContain("export const maxDuration = 60");
    expect(syncRoute).toContain("const AUTOMATIC_QUEUE_CRON_BATCH_SIZE = 5");
    expect(factsRoute).toContain("export const maxDuration = 60");
    expect(revalidationRoute).toContain("export const maxDuration = 60");
    expect(revalidationRoute).toContain("const REVALIDATION_BATCH_SIZE = 10");
    expect(providerPolicy).toContain("const VARDEFULLA_DATA_MIN_INTERVAL_MS = 1_050");
    expect(providerPolicy).toContain("not a distributed global limiter");
  });

  it("keeps twice-hourly Booking recovery slack across normal, delayed, and one missed interval", () => {
    const booking = read("src/lib/booking-reminders.ts");
    const base = Date.UTC(2026, 8, 6, 10, 8, 0);
    const runs = halfHourlyRuns(base, 8);
    const reminderDue = base + 72 * 60 * 1_000;

    expect(new Date(firstEligibleRun(reminderDue, runs) ?? 0).toISOString()).toBe("2026-09-06T11:38:00.000Z");

    const delayedRuns = runs.map((runAtMs) => (
      runAtMs === Date.UTC(2026, 8, 6, 11, 38, 0)
        ? runAtMs + 20 * 60 * 1_000
        : runAtMs
    )).sort((a, b) => a - b);
    expect(new Date(firstEligibleRun(reminderDue, delayedRuns) ?? 0).toISOString()).toBe("2026-09-06T11:58:00.000Z");

    const missedRun = Date.UTC(2026, 8, 6, 11, 38, 0);
    const missedIntervalRuns = runs.filter((runAtMs) => runAtMs !== missedRun);
    expect(new Date(firstEligibleRun(reminderDue, missedIntervalRuns) ?? 0).toISOString()).toBe("2026-09-06T12:08:00.000Z");

    const previousSuccessfulRun = Date.UTC(2026, 8, 6, 11, 8, 0);
    const nextSuccessfulRun = Date.UTC(2026, 8, 6, 12, 8, 0);
    for (let dueAtMs = previousSuccessfulRun; dueAtMs <= nextSuccessfulRun; dueAtMs += 60 * 1_000) {
      expect(
        firstEligibleRun(dueAtMs, missedIntervalRuns),
        `reminder due ${new Date(dueAtMs).toISOString()} must remain recoverable`,
      ).toBeDefined();
    }

    expect(booking).toContain("coalesce(s.hours_before,24)-1");
    expect(booking).toContain("b.starts_at<=now()+(coalesce(s.hours_before,24)||' hours')::interval");
    expect(booking).toContain("on conflict do nothing returning id");
  });

  it("preserves event-driven Marketplace primary processing and duplicate protection", () => {
    const triggerProof = read("tests/quote-request-marketplace-trigger.test.ts");

    expect(triggerProof).toContain("kicks only the newly persisted Quote Request without delaying the response");
    expect(triggerProof).toContain("does not schedule the worker for a recent duplicate Quote Request");
    expect(triggerProof).toContain("targetReferenceIds: [\"PRO-TEST-12345\"]");
  });

  it("preserves exact-SHA deployment health and fail-closed DB-backed schema verification", () => {
    const workflow = read(".github/workflows/production-health.yml");
    const health = read("src/lib/production-schema-health.ts");

    expect(workflow).toContain("require_exact_commit=yes");
    expect(workflow).toContain('deployed_sha" != "$TARGET_SHA"');
    expect(workflow).toContain("Production health gate failed for the deployed release/schema contract");
    expect(health).toContain("proffera_schema_migrations");
    expect(health).toContain("pg_index");
  });
});

describe("direct child scheduler authorization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const mock of Object.values(mocks)) mock.mockReset();

    process.env = {
      ...originalEnv,
      CRON_SECRET: "internal-cron-secret",
      PRODUCTION_SCHEDULER_SECRET: "qstash-scheduler-secret",
      COMPANY_DIRECTORY_SYNC_ENABLED: "true",
      COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED: "true",
      COMPANY_DIRECTORY_DISCOVERY_MODE: "seed",
      COMPANY_DIRECTORY_SOURCE_URL: "https://example.test/company-directory-source.json",
    };

    mocks.processBookingReminders.mockResolvedValue({
      checked: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      autoCompleted: 0,
    });
    mocks.enrichCompanyDirectoryOfficialFacts.mockResolvedValue({ enriched: 0, failed: 0 });
    mocks.syncCompanyDirectory.mockResolvedValue({
      scanned: 0,
      upserted: 0,
      published: 0,
      blocked: 0,
      errors: 0,
      errorSummary: "",
    });
    mocks.getSql.mockReturnValue(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepts the scoped PRODUCTION_SCHEDULER_SECRET on all three direct children", async () => {
    const { booking, officialFacts, directorySync } = await loadChildRoutes();

    const bookingResponse = await booking.GET(childRequest(
      "https://www.proffera.se/api/cron/booking-reminders",
      "qstash-scheduler-secret",
    ));
    const factsResponse = await officialFacts.GET(childRequest(
      "https://www.proffera.se/api/cron/company-directory-official-facts?limit=7",
      "qstash-scheduler-secret",
    ));
    const syncResponse = await directorySync.GET(childRequest(
      "https://www.proffera.se/api/cron/company-directory-sync",
      "qstash-scheduler-secret",
    ));

    expect([bookingResponse.status, factsResponse.status, syncResponse.status]).toEqual([200, 200, 200]);
    expect(mocks.processBookingReminders).toHaveBeenCalledTimes(1);
    expect(mocks.enrichCompanyDirectoryOfficialFacts).toHaveBeenCalledWith(7);
    expect(mocks.syncCompanyDirectory).toHaveBeenCalledTimes(1);
  });

  it("preserves existing CRON_SECRET compatibility on all three direct children", async () => {
    const { booking, officialFacts, directorySync } = await loadChildRoutes();

    const responses = await Promise.all([
      booking.GET(childRequest("https://www.proffera.se/api/cron/booking-reminders", "internal-cron-secret")),
      officialFacts.GET(childRequest(
        "https://www.proffera.se/api/cron/company-directory-official-facts?limit=10",
        "internal-cron-secret",
      )),
      directorySync.GET(childRequest("https://www.proffera.se/api/cron/company-directory-sync", "internal-cron-secret")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
  });

  it("rejects missing and wrong credentials without exposing either configured secret", async () => {
    const { booking, officialFacts, directorySync } = await loadChildRoutes();
    const requests = [
      () => booking.GET(childRequest("https://www.proffera.se/api/cron/booking-reminders")),
      () => officialFacts.GET(childRequest("https://www.proffera.se/api/cron/company-directory-official-facts?limit=10")),
      () => directorySync.GET(childRequest("https://www.proffera.se/api/cron/company-directory-sync")),
      () => booking.GET(childRequest("https://www.proffera.se/api/cron/booking-reminders", "wrong-secret")),
      () => officialFacts.GET(childRequest(
        "https://www.proffera.se/api/cron/company-directory-official-facts?limit=10",
        "wrong-secret",
      )),
      () => directorySync.GET(childRequest("https://www.proffera.se/api/cron/company-directory-sync", "wrong-secret")),
    ];

    for (const run of requests) {
      const response = await run();
      const body = await response.text();
      expect(response.status).toBe(401);
      expect(body).toContain("Unauthorized");
      expect(body).not.toContain("internal-cron-secret");
      expect(body).not.toContain("qstash-scheduler-secret");
    }

    expect(mocks.processBookingReminders).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();
  });
});
