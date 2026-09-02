import "server-only";

import {
  DEFAULT_MARKETPLACE_WAVE2_DELAY_MS,
  processMarketplaceAutoWorker,
} from "@/lib/marketplace-auto-worker";

export type MarketplaceAutoWorkerTriggerResult =
  | Awaited<ReturnType<typeof processMarketplaceAutoWorker>>
  | {
      ok: true;
      skipped: "disabled" | "production_not_authorized" | "production_cutoff_not_configured";
    };

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function validRolloutCutoff(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && Number.isFinite(Date.parse(normalized)));
}

export async function runMarketplaceAutoWorkerTrigger(input: {
  baseUrl: string;
  targetReferenceIds?: string[];
  previewE2eRunId?: string;
}): Promise<MarketplaceAutoWorkerTriggerResult> {
  if (process.env.MARKETPLACE_AUTO_WORKER_ENABLED !== "true") {
    return { ok: true, skipped: "disabled" };
  }

  const isProduction = process.env.VERCEL_ENV === "production";
  if (isProduction && process.env.MARKETPLACE_AUTO_WORKER_ALLOW_PRODUCTION !== "true") {
    return { ok: true, skipped: "production_not_authorized" };
  }

  if (isProduction && !validRolloutCutoff(process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE)) {
    return { ok: true, skipped: "production_cutoff_not_configured" };
  }

  const wave2DelayMinutes = boundedNumber(
    process.env.MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES,
    DEFAULT_MARKETPLACE_WAVE2_DELAY_MS / 60_000,
    15,
    24 * 60,
  );
  const batchSize = boundedNumber(process.env.MARKETPLACE_AUTO_WORKER_BATCH_SIZE, 5, 1, 10);

  return processMarketplaceAutoWorker({
    baseUrl: input.baseUrl,
    batchSize,
    wave2DelayMs: wave2DelayMinutes * 60_000,
    targetReferenceIds: input.targetReferenceIds,
    previewE2eRunId: input.previewE2eRunId,
  });
}
