import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runMarketplaceAutoWorkerTrigger } from "@/lib/marketplace-auto-worker-trigger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  try {
    const result = await runMarketplaceAutoWorkerTrigger({
      baseUrl: new URL(request.url).origin,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    console.error("Marketplace Auto Worker cron failed", error);
    return NextResponse.json({ ok: false, error: "worker_failed" }, { status: 500 });
  }
}
