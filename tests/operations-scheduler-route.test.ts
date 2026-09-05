import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/booking-reminders", () => ({
  processBookingReminders: mocks.processBookingReminders,
}));
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFacts: mocks.enrichCompanyDirectoryOfficialFacts,
}));
vi.mock("@/lib/company-directory-discovery-queue", () => ({
  processCompanyDirectoryDiscoveryQueue: mocks.processCompanyDirectoryDiscoveryQueue,
  processNewCompanyDirectoryDiscoveryQueueBatch: mocks.processNewCompanyDirectoryDiscoveryQueueBatch,
}));
vi.mock("@/lib/company-directory-engine", () => ({
  syncCompanyDirectory: mocks.syncCompanyDirectory,
}));
vi.mock("@/lib/company-directory-published-revalidation", () => ({
  revalidatePublishedCompanyDirectoryBatch: mocks.revalidatePublishedCompanyDirectoryBatch,
}));
vi.mock("@/lib/company-directory-ready-auto-publish", () => ({
  autoPublishReadyHighConfidenceCompanyDirectoryBatch: mocks.autoPublishReadyHighConfidenceCompanyDirectoryBatch,
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

const EMPTY_BOOKING_RESULT = {
  checked: 0,
  sent: 0,
  skipped: 0,
  failed: 0,
  autoCompleted: 0,
};

async function loadOperationsRoute() {
  vi.resetModules();
  return await import("../src/app/api/cron/operations/route");
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

function request(secret: string, url = "https://www.proffera.se/api/cron/operations") {
  return new Request(url, {
    headers: { authorization: `Bearer ${secret}` },
  });
}

function authorizedChildRequest(url: string) {
  return new Request(url, {
    headers: { authorization: "Bearer internal-cron-secret" },
  });
}

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Operations scheduler route", () => {
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

    mocks.processBookingReminders.mockResolvedValue({ ...EMPTY_BOOKING_RESULT });
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fails closed before running child jobs when authorization is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadOperationsRoute();

    const response = await GET(request("wrong-secret"));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.processBookingReminders).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();
  });

  it("rejects an authorized request on a non-canonical host before running child jobs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadOperationsRoute();

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
    expect(mocks.processBookingReminders).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();
  });

  it("runs the three existing cron jobs in-process and in the established order", async () => {
    const order: string[] = [];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mocks.processBookingReminders.mockImplementation(async () => {
      order.push("booking_reminders");
      return { ...EMPTY_BOOKING_RESULT };
    });
    mocks.enrichCompanyDirectoryOfficialFacts.mockImplementation(async (limit: number) => {
      order.push(`company_directory_official_facts:${limit}`);
      return { enriched: 0, failed: 0 };
    });
    mocks.syncCompanyDirectory.mockImplementation(async () => {
      order.push("company_directory_sync");
      return {
        scanned: 0,
        upserted: 0,
        published: 0,
        blocked: 0,
        errors: 0,
        errorSummary: "",
      };
    });
    const { GET } = await loadOperationsRoute();

    const response = await GET(request("qstash-scheduler-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(order).toEqual([
      "booking_reminders",
      "company_directory_official_facts:10",
      "company_directory_sync",
    ]);
    expect(mocks.enrichCompanyDirectoryOfficialFacts).toHaveBeenCalledWith(10);
    expect(body).toEqual({
      ok: true,
      results: [
        { name: "booking_reminders", ok: true, status: 200 },
        { name: "company_directory_official_facts", ok: true, status: 200 },
        { name: "company_directory_sync", ok: true, status: 200 },
      ],
    });
  });

  it("preserves CRON_SECRET authorization for GitHub/manual recovery", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadOperationsRoute();

    const response = await GET(request("internal-cron-secret"));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.processBookingReminders).toHaveBeenCalledTimes(1);
    expect(mocks.enrichCompanyDirectoryOfficialFacts).toHaveBeenCalledWith(10);
    expect(mocks.syncCompanyDirectory).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the external request is authorized but the child credential is unavailable", async () => {
    delete process.env.CRON_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadOperationsRoute();

    const response = await GET(request("qstash-scheduler-secret"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Scheduler child credential unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.processBookingReminders).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();
  });

  it("waits for each in-process job before starting the next one", async () => {
    let releaseBooking!: (value: typeof EMPTY_BOOKING_RESULT) => void;
    const pendingBooking = new Promise<typeof EMPTY_BOOKING_RESULT>((resolveBooking) => {
      releaseBooking = resolveBooking;
    });
    mocks.processBookingReminders.mockReturnValueOnce(pendingBooking);
    const { GET } = await loadOperationsRoute();

    const responsePromise = GET(request("qstash-scheduler-secret"));

    await vi.waitFor(() => {
      expect(mocks.processBookingReminders).toHaveBeenCalledTimes(1);
    });
    expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();

    releaseBooking({ ...EMPTY_BOOKING_RESULT });
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(mocks.enrichCompanyDirectoryOfficialFacts).toHaveBeenCalledTimes(1);
    expect(mocks.syncCompanyDirectory).toHaveBeenCalledTimes(1);
  });

  it("times out a slow in-process child after 75 seconds and still attempts later jobs", async () => {
    vi.useFakeTimers();
    mocks.processBookingReminders.mockReturnValueOnce(
      new Promise<typeof EMPTY_BOOKING_RESULT>(() => undefined),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await loadOperationsRoute();

    try {
      const responsePromise = GET(request("qstash-scheduler-secret"));

      expect(mocks.processBookingReminders).toHaveBeenCalledTimes(1);
      expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
      expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(75_000);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      expect(mocks.enrichCompanyDirectoryOfficialFacts).toHaveBeenCalledWith(10);
      expect(mocks.syncCompanyDirectory).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        results: [
          { name: "booking_reminders", ok: false, status: 0 },
          { name: "company_directory_official_facts", ok: true, status: 200 },
          { name: "company_directory_sync", ok: true, status: 200 },
        ],
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("records a child failure with the child route status and still runs the remaining job", async () => {
    mocks.enrichCompanyDirectoryOfficialFacts.mockRejectedValueOnce(new Error("official facts unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await loadOperationsRoute();

    try {
      const response = await GET(request("qstash-scheduler-secret"));

      expect(response.status).toBe(503);
      expect(mocks.syncCompanyDirectory).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        results: [
          { name: "booking_reminders", ok: true, status: 200 },
          { name: "company_directory_official_facts", ok: false, status: 500 },
          { name: "company_directory_sync", ok: true, status: 200 },
        ],
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("preserves disabled Directory skip semantics without running Directory business work", async () => {
    process.env.COMPANY_DIRECTORY_SYNC_ENABLED = "false";
    const { GET } = await loadOperationsRoute();

    const response = await GET(request("qstash-scheduler-secret"));

    expect(response.status).toBe(200);
    expect(mocks.processBookingReminders).toHaveBeenCalledTimes(1);
    expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      results: [
        { name: "booking_reminders", ok: true, status: 200 },
        { name: "company_directory_official_facts", ok: true, status: 200 },
        { name: "company_directory_sync", ok: true, status: 200 },
      ],
    });
  });

  it("keeps each child cron endpoint independently protected by CRON_SECRET", async () => {
    const { booking, officialFacts, directorySync } = await loadChildRoutes();

    const responses = await Promise.all([
      booking.GET(new Request("https://www.proffera.se/api/cron/booking-reminders")),
      officialFacts.GET(new Request("https://www.proffera.se/api/cron/company-directory-official-facts?limit=10")),
      directorySync.GET(new Request("https://www.proffera.se/api/cron/company-directory-sync")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    expect(mocks.processBookingReminders).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFacts).not.toHaveBeenCalled();
    expect(mocks.syncCompanyDirectory).not.toHaveBeenCalled();
  });

  it("keeps each child cron endpoint independently callable with CRON_SECRET", async () => {
    const { booking, officialFacts, directorySync } = await loadChildRoutes();

    const bookingResponse = await booking.GET(authorizedChildRequest(
      "https://www.proffera.se/api/cron/booking-reminders",
    ));
    const factsResponse = await officialFacts.GET(authorizedChildRequest(
      "https://www.proffera.se/api/cron/company-directory-official-facts?limit=7",
    ));
    const syncResponse = await directorySync.GET(authorizedChildRequest(
      "https://www.proffera.se/api/cron/company-directory-sync",
    ));

    expect([bookingResponse.status, factsResponse.status, syncResponse.status]).toEqual([200, 200, 200]);
    expect(mocks.processBookingReminders).toHaveBeenCalledTimes(1);
    expect(mocks.enrichCompanyDirectoryOfficialFacts).toHaveBeenCalledWith(7);
    expect(mocks.syncCompanyDirectory).toHaveBeenCalledTimes(1);
  });

  it("contains no Production self-fetch and leaves scheduler configuration outside this route", () => {
    const operationsRoute = source("src/app/api/cron/operations/route.ts");
    const vercelConfig = source("vercel.json");
    const recoveryWorkflow = source(".github/workflows/booking-reminders.yml");

    expect(operationsRoute).not.toMatch(/\bfetch\s*\(/);
    expect(operationsRoute).toContain("const CHILD_JOB_TIMEOUT_MS = 75_000;");
    expect(operationsRoute).toContain("runChildJobWithTimeout");
    expect(operationsRoute).toContain("new AbortController()");
    expect(operationsRoute).toContain('GET as runBookingReminders');
    expect(operationsRoute).toContain('GET as runCompanyDirectoryOfficialFacts');
    expect(operationsRoute).toContain('GET as runCompanyDirectorySync');
    expect(vercelConfig).not.toContain('/api/cron/operations');
    expect(vercelConfig).toContain('/api/cron/company-directory-official-facts');
    expect(recoveryWorkflow).toContain("workflow_dispatch:");
    expect(recoveryWorkflow).not.toContain("schedule:");
  });
});
