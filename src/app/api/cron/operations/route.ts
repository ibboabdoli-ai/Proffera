import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { GET as runBookingReminders } from "../booking-reminders/route";
import { GET as runCompanyDirectoryOfficialFacts } from "../company-directory-official-facts/route";
import { GET as runCompanyDirectorySync } from "../company-directory-sync/route";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

const PRODUCTION_ORIGIN = "https://www.proffera.se";
const ALLOWED_REQUEST_HOSTS = new Set(["proffera.se", "www.proffera.se"]);
const OPERATIONS_JOBS = [
  {
    name: "booking_reminders",
    path: "/api/cron/booking-reminders",
    run: runBookingReminders,
  },
  {
    name: "company_directory_official_facts",
    path: "/api/cron/company-directory-official-facts?limit=10",
    run: runCompanyDirectoryOfficialFacts,
  },
  {
    name: "company_directory_sync",
    path: "/api/cron/company-directory-sync",
    run: runCompanyDirectorySync,
  },
] as const;

const CHILD_JOB_TIMEOUT_MS = 75_000;

function bearerMatches(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function authorizedSchedulerRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  return bearerMatches(authorization, process.env.CRON_SECRET)
    || bearerMatches(authorization, process.env.PRODUCTION_SCHEDULER_SECRET);
}

function canonicalProductionRequest(request: Request) {
  const url = new URL(request.url);
  return url.protocol === "https:"
    && url.port === ""
    && ALLOWED_REQUEST_HOSTS.has(url.hostname.toLowerCase());
}

function childRequest(path: string, secret: string, signal: AbortSignal) {
  return new Request(new URL(path, PRODUCTION_ORIGIN), {
    method: "GET",
    headers: {
      authorization: `Bearer ${secret}`,
      "user-agent": "proffera-qstash-operations-scheduler",
    },
    signal,
  });
}

async function runChildJobWithTimeout(
  job: (typeof OPERATIONS_JOBS)[number],
  secret: string,
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Operations scheduler job timed out after ${CHILD_JOB_TIMEOUT_MS}ms`));
    }, CHILD_JOB_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      job.run(childRequest(job.path, secret, controller.signal)),
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function GET(request: Request) {
  if (!authorizedSchedulerRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!canonicalProductionRequest(request)) {
    return NextResponse.json({ ok: false, error: "Invalid scheduler origin" }, { status: 400 });
  }

  const childSecret = process.env.CRON_SECRET;
  if (!childSecret) {
    return NextResponse.json(
      { ok: false, error: "Scheduler child credential unavailable" },
      { status: 503 },
    );
  }

  const results: Array<{
    name: (typeof OPERATIONS_JOBS)[number]["name"];
    ok: boolean;
    status: number;
  }> = [];

  for (const job of OPERATIONS_JOBS) {
    try {
      const response = await runChildJobWithTimeout(job, childSecret);
      results.push({
        name: job.name,
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      console.error(`Operations scheduler job failed: ${job.name}`, error);
      results.push({
        name: job.name,
        ok: false,
        status: 0,
      });
    }
  }

  const ok = results.every((result) => result.ok);
  return NextResponse.json(
    { ok, results },
    { status: ok ? 200 : 503 },
  );
}
