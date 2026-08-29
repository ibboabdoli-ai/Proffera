import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

const OPERATIONS_ENDPOINTS = [
  {
    name: "booking_reminders",
    path: "/api/cron/booking-reminders",
  },
  {
    name: "company_directory_official_facts",
    path: "/api/cron/company-directory-official-facts?limit=10",
  },
  {
    name: "company_directory_sync",
    path: "/api/cron/company-directory-sync",
  },
] as const;

const CHILD_REQUEST_TIMEOUT_MS = 75_000;

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

export async function GET(request: Request) {
  if (!authorizedSchedulerRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const childSecret = process.env.CRON_SECRET;
  if (!childSecret) {
    return NextResponse.json(
      { ok: false, error: "Scheduler child credential unavailable" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const results: Array<{
    name: (typeof OPERATIONS_ENDPOINTS)[number]["name"];
    ok: boolean;
    status: number;
  }> = [];

  for (const endpoint of OPERATIONS_ENDPOINTS) {
    try {
      const response = await fetch(new URL(endpoint.path, origin), {
        method: "GET",
        headers: {
          authorization: `Bearer ${childSecret}`,
          "user-agent": "proffera-qstash-operations-scheduler",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(CHILD_REQUEST_TIMEOUT_MS),
      });

      results.push({
        name: endpoint.name,
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      console.error(`Operations scheduler endpoint failed: ${endpoint.name}`, error);
      results.push({
        name: endpoint.name,
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
