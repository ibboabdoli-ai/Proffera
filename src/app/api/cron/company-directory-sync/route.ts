import { NextResponse } from "next/server";

import {
  processCompanyDirectoryDiscoveryQueue,
  processNewCompanyDirectoryDiscoveryQueueBatch,
} from "@/lib/company-directory-discovery-queue";
import { syncCompanyDirectory } from "@/lib/company-directory-engine";
import { revalidatePublishedCompanyDirectoryBatch } from "@/lib/company-directory-published-revalidation";
import { autoPublishReadyHighConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-ready-auto-publish";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AUTOMATIC_QUEUE_CRON_BATCH_SIZE = 5;
const PUBLISHED_REVALIDATION_AUTOMATIC_BATCH_SIZE = 2;
const AUTOMATIC_QUEUE_HISTORY_PROVIDER = "automatic_queue";
const AUTOMATIC_QUEUE_DEADLINE_BUFFER_MS = 5_000;

const EMPTY_QUEUE_RESULT = {
  claimed: 0,
  processed: 0,
  published: 0,
  blocked: 0,
  errors: 0,
  errorSummary: "",
};

const FAILED_PUBLISHED_REVALIDATION_RESULT = {
  skipped: true,
  reason: "worker_error",
  selected: 0,
  revalidated: 0,
  keptPublished: 0,
  movedToReview: 0,
  deferred: 0,
  errors: 1,
  errorSummary: "Published revalidation worker failed",
  reviewSummary: "",
  remaining: null as number | null,
};

type AutomaticQueueRun = {
  status: "completed" | "failed";
  startedAt: string;
  scanned: number;
  upserted: number;
  published: number;
  blocked: number;
  errors: number;
  errorSummary: string;
};

function automaticQueueErrorSummary(...values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).join(" | ").slice(0, 4000);
}

async function recordAutomaticQueueSyncRun(run: AutomaticQueueRun) {
  const sql = getSql();
  if (!sql) return;

  await sql`
    insert into company_directory_sync_runs (
      provider, status, scanned_count, upserted_count, published_count,
      blocked_count, error_count, error_summary, started_at, completed_at
    ) values (
      ${AUTOMATIC_QUEUE_HISTORY_PROVIDER}, ${run.status}, ${run.scanned}, ${run.upserted},
      ${run.published}, ${run.blocked}, ${run.errors}, ${run.errorSummary},
      ${run.startedAt}::timestamptz, now()
    )
  `;
}

async function recordAutomaticQueueSyncRunSafely(run: AutomaticQueueRun) {
  try {
    await recordAutomaticQueueSyncRun(run);
    return true;
  } catch (error) {
    console.error("Company directory automatic queue history write failed", error);
    return false;
  }
}

async function revalidatePublishedCompanyDirectorySafely(deadlineAt: number) {
  try {
    return await revalidatePublishedCompanyDirectoryBatch(
      PUBLISHED_REVALIDATION_AUTOMATIC_BATCH_SIZE,
      { deadlineAt },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Published revalidation worker failed";
    console.error("Company directory published revalidation failed inside automatic queue", error);
    return {
      ...FAILED_PUBLISHED_REVALIDATION_RESULT,
      errorSummary: message,
    };
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const enabled = process.env.COMPANY_DIRECTORY_SYNC_ENABLED === "true";
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory sync is disabled",
    });
  }

  const profileProcessingEnabled = process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED === "true";
  if (!profileProcessingEnabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Company directory profile processing is disabled",
    });
  }

  const mode = process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase();
  const automaticQueueStartedAtMs = Date.now();
  const automaticQueueStartedAt = new Date(automaticQueueStartedAtMs).toISOString();
  const revalidationDeadlineAt = automaticQueueStartedAtMs
    + maxDuration * 1_000
    - AUTOMATIC_QUEUE_DEADLINE_BUFFER_MS;

  try {
    if (mode === "automatic") {
      const readyAutoPublish = await autoPublishReadyHighConfidenceCompanyDirectoryBatch();
      const newCompanies = await processNewCompanyDirectoryDiscoveryQueueBatch(AUTOMATIC_QUEUE_CRON_BATCH_SIZE);
      const remainingBatchSize = Math.max(0, AUTOMATIC_QUEUE_CRON_BATCH_SIZE - newCompanies.claimed);
      const result = remainingBatchSize > 0
        ? await processCompanyDirectoryDiscoveryQueue(remainingBatchSize)
        : EMPTY_QUEUE_RESULT;
      const publishedRevalidation = await revalidatePublishedCompanyDirectorySafely(revalidationDeadlineAt);
      const history = {
        scanned: readyAutoPublish.scanned + newCompanies.claimed + result.claimed
          + publishedRevalidation.selected,
        upserted: newCompanies.processed + result.processed
          + publishedRevalidation.revalidated,
        published: readyAutoPublish.published + newCompanies.published + result.published,
        blocked: newCompanies.blocked + result.blocked + publishedRevalidation.movedToReview,
        errors: readyAutoPublish.errors + newCompanies.errors + result.errors
          + publishedRevalidation.errors,
        errorSummary: automaticQueueErrorSummary(
          readyAutoPublish.errorSummary,
          newCompanies.errorSummary,
          result.errorSummary,
          publishedRevalidation.errorSummary,
        ),
      };

      const historyRecorded = await recordAutomaticQueueSyncRunSafely({
        status: "completed",
        startedAt: automaticQueueStartedAt,
        ...history,
      });

      return NextResponse.json({
        ok: true,
        mode: "automatic_queue",
        ...result,
        newCompanies,
        readyAutoPublish,
        publishedRevalidation,
        historyRecorded,
      });
    }

    if (!process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim()) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Company directory source is not configured",
      });
    }

    const result = await syncCompanyDirectory();
    return NextResponse.json({ ok: true, mode: mode || "seed", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Company directory sync failed";
    if (mode === "automatic") {
      await recordAutomaticQueueSyncRunSafely({
        status: "failed",
        startedAt: automaticQueueStartedAt,
        scanned: 0,
        upserted: 0,
        published: 0,
        blocked: 0,
        errors: 1,
        errorSummary: message,
      });
    }
    console.error("Company directory sync cron failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
