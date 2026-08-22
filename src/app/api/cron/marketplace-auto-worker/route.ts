import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  DEFAULT_MARKETPLACE_WAVE2_DELAY_MS,
  processMarketplaceAutoWorker,
} from "@/lib/marketplace-auto-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function authorizedSchedulerRequest(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorizedSchedulerRequest(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.MARKETPLACE_AUTO_WORKER_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  if (
    process.env.VERCEL_ENV === "production"
    && process.env.MARKETPLACE_AUTO_WORKER_ALLOW_PRODUCTION !== "true"
  ) {
    return NextResponse.json({ ok: true, skipped: "production_not_authorized" });
  }

  const wave2DelayMinutes = boundedNumber(
    process.env.MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES,
    DEFAULT_MARKETPLACE_WAVE2_DELAY_MS / 60_000,
    15,
    24 * 60,
  );
  const batchSize = boundedNumber(process.env.MARKETPLACE_AUTO_WORKER_BATCH_SIZE, 5, 1, 10);

  try {
    const result = await processMarketplaceAutoWorker({
      baseUrl: new URL(request.url).origin,
      batchSize,
      wave2DelayMs: wave2DelayMinutes * 60_000,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    console.error("Marketplace Auto Worker cron failed", error);
    return NextResponse.json({ ok: false, error: "worker_failed" }, { status: 500 });
  }
}
