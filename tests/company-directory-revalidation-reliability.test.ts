import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const httpsMock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request: httpsMock.request }));

const ENV_KEYS = [
  "SCB_COMPANY_REGISTRY_PFX_BASE64",
  "SCB_COMPANY_REGISTRY_PFX_PASSPHRASE",
  "SCB_COMPANY_REGISTRY_BASE_URL",
] as const;
const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

type Outcome = { status: number; body?: unknown } | Error;

function installOutcomes(outcomes: Outcome[], callTimes: number[]) {
  const queue = [...outcomes];
  httpsMock.request.mockImplementation((_url, _options, callback) => {
    callTimes.push(Date.now());
    const request = new EventEmitter() as EventEmitter & {
      write: (body: string) => void;
      end: () => void;
      destroy: (error: Error) => void;
    };
    request.write = vi.fn();
    request.destroy = (error: Error) => queueMicrotask(() => request.emit("error", error));
    request.end = () => {
      const outcome = queue.shift();
      if (!outcome) throw new Error("Missing mocked SCB outcome");
      if (outcome instanceof Error) {
        queueMicrotask(() => request.emit("error", outcome));
        return;
      }
      const response = new EventEmitter() as EventEmitter & { statusCode: number };
      response.statusCode = outcome.status;
      callback(response);
      queueMicrotask(() => {
        if (outcome.body !== undefined) response.emit("data", Buffer.from(JSON.stringify(outcome.body)));
        response.emit("end");
      });
    };
    return request;
  });
}

async function loadTransport() {
  vi.resetModules();
  return await import("../src/lib/company-directory-scb-transport");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-21T08:00:00Z"));
  httpsMock.request.mockReset();
  process.env.SCB_COMPANY_REGISTRY_PFX_BASE64 = Buffer.from("test-pfx").toString("base64");
  process.env.SCB_COMPANY_REGISTRY_PFX_PASSPHRASE = "test-passphrase";
  process.env.SCB_COMPANY_REGISTRY_BASE_URL = "https://scb.example.test/";
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of ENV_KEYS) {
    const value = previousEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Company Directory revalidation reliability", () => {
  it("retries one transient ECONNRESET with backoff and shared request-slot spacing", async () => {
    const callTimes: number[] = [];
    const reset = Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
    installOutcomes([
      reset,
      { status: 200, body: { workplaces: true } },
      { status: 200, body: { company: true } },
    ], callTimes);
    const { createScbCompanyRegistryTransportFromEnv } = await loadTransport();
    const transport = createScbCompanyRegistryTransportFromEnv();
    expect(transport).not.toBeNull();

    const companyPending = transport!.fetchCompany("5563115707");
    await vi.advanceTimersByTimeAsync(0);
    expect(httpsMock.request).toHaveBeenCalledTimes(1);

    const workplacesPending = transport!.fetchWorkplaces("5563115707");
    await vi.advanceTimersByTimeAsync(1_049);
    expect(httpsMock.request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(httpsMock.request).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(449);
    expect(httpsMock.request).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(httpsMock.request).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(600);

    await expect(workplacesPending).resolves.toEqual({ workplaces: true });
    await expect(companyPending).resolves.toEqual({ company: true });
    expect(httpsMock.request).toHaveBeenCalledTimes(3);
    expect(callTimes[2] - callTimes[0]).toBeGreaterThanOrEqual(1_500);
    for (let index = 1; index < callTimes.length; index += 1) {
      expect(callTimes[index] - callTimes[index - 1]).toBeGreaterThanOrEqual(1_050);
    }
  });

  it("does not retry permanent HTTP failures", async () => {
    const callTimes: number[] = [];
    installOutcomes([{ status: 404 }], callTimes);
    const { createScbCompanyRegistryTransportFromEnv } = await loadTransport();
    const transport = createScbCompanyRegistryTransportFromEnv();

    await expect(transport!.fetchCompany("5563115707"))
      .rejects.toThrow("SCB company registry request failed with HTTP 404");
    expect(httpsMock.request).toHaveBeenCalledTimes(1);
  });

  it("stops after the single retry when transient failures continue", async () => {
    const callTimes: number[] = [];
    const firstReset = Object.assign(new Error("first reset"), { code: "ECONNRESET" });
    const secondReset = Object.assign(new Error("second reset"), { code: "ECONNRESET" });
    installOutcomes([firstReset, secondReset], callTimes);
    const { createScbCompanyRegistryTransportFromEnv } = await loadTransport();
    const transport = createScbCompanyRegistryTransportFromEnv();

    const pending = transport!.fetchCompany("5563115707");
    const rejection = expect(pending).rejects.toThrow("second reset");
    await vi.advanceTimersByTimeAsync(1_500);
    await rejection;
    expect(httpsMock.request).toHaveBeenCalledTimes(2);
  });

  it("drains two bounded batches per scheduler wake-up without changing the five-minute cadence", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/company-directory-revalidation.yml"), "utf8");
    expect(workflow).toContain('cron: "*/5 * * * *"');
    expect(workflow).toContain("BATCHES_PER_RUN=2");
    expect(workflow).toContain('for batch in $(seq 1 "$BATCHES_PER_RUN")');
    expect(workflow).toContain("/api/cron/company-directory-revalidation");
    expect(workflow).not.toContain("/api/cron/company-directory-sync");
  });
});
