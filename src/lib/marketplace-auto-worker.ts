import "server-only";

import { marketplaceGuestInvitationEmailConfigured } from "@/features/email/marketplace-guest-invitation-email";
import { getDirectoryGuestLeadMatch } from "@/features/matching/directory-guest-single";
import {
  getMarketplaceAutoQueuePage,
  MARKETPLACE_AUTO_QUEUE_PAGE_SIZE,
  type MarketplaceAutoQueueRow,
} from "@/features/matching/marketplace-auto-queue";
import {
  expirePastMarketplaceInvitation,
  getMarketplaceInvitationSummaries,
  type MarketplaceLeadInvitationSummary,
} from "@/features/matching/marketplace-invitation-state";
import { planMarketplaceGuestWave } from "@/features/matching/marketplace-wave-plan";
import { sendMarketplaceGuestQuoteInvitation } from "@/lib/marketplace-guest-quote";
import {
  applyMarketplaceRematchContext,
  finalizeMarketplaceRematchWork,
  prepareMarketplaceRematchWork,
  type MarketplaceRematchWorkerContext,
} from "@/lib/marketplace-rematch-worker";

export const MARKETPLACE_AUTO_WORKER_ACTOR = "system:marketplace-auto-worker";
export const DEFAULT_MARKETPLACE_WAVE2_DELAY_MS = 6 * 60 * 60 * 1000;

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 10;
const DEFAULT_WORKER_DEADLINE_MS = 45_000;
const INVITATION_STATE_TIMEOUT_MS = 3_000;
const INVITATION_SEND_TIMEOUT_MS = 8_000;
const REMATCH_FINALIZE_TIMEOUT_MS = 3_000;

type AutoWaveDecisionReason = "wave1" | "wave2" | "enough_offers" | "wave_full" | "wave2_waiting";

export type MarketplaceAutoWaveDecision = {
  wave: 1 | 2 | null;
  reason: AutoWaveDecisionReason;
};

export type MarketplaceAutoWorkerResult = {
  ok: true;
  scanned: number;
  attempted: number;
  sent: number;
  wave1Sent: number;
  wave2Sent: number;
  deadlineReached: boolean;
  skipped: Record<string, number>;
};

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(value as number)));
}

function finiteDelayMs(value: number | undefined) {
  const candidate = value ?? DEFAULT_MARKETPLACE_WAVE2_DELAY_MS;
  return Number.isFinite(candidate)
    ? Math.max(0, candidate)
    : DEFAULT_MARKETPLACE_WAVE2_DELAY_MS;
}

function normalizedOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function normalizedTargetReferenceIds(values: string[] | undefined) {
  return [...new Set((values ?? [])
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter((value) => /^PRO-[A-Z0-9]+-[A-Z0-9]+$/.test(value)))]
    .slice(0, 10);
}

function submittedOfferCount(offers: Array<{ status: string }>) {
  return offers.filter((offer) => offer.status === "submitted" || offer.status === "selected").length;
}

function increment(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), Math.max(1, timeoutMs));
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function decideMarketplaceAutoWave(input: {
  invitationSummary: MarketplaceLeadInvitationSummary;
  submittedOfferCount: number;
  nowMs: number;
  wave2DelayMs: number;
}): MarketplaceAutoWaveDecision {
  const { invitationSummary } = input;
  if (input.submittedOfferCount >= 2) return { wave: null, reason: "enough_offers" };
  if (invitationSummary.wave1Count < 3) return { wave: 1, reason: "wave1" };
  if (invitationSummary.wave2Count >= 2 || invitationSummary.totalCount >= 5) {
    return { wave: null, reason: "wave_full" };
  }

  const latestWave1At = Date.parse(String(invitationSummary.latestWave1At ?? ""));
  const delay = finiteDelayMs(input.wave2DelayMs);
  if (!Number.isFinite(latestWave1At) || input.nowMs - latestWave1At < delay) {
    return { wave: null, reason: "wave2_waiting" };
  }

  return { wave: 2, reason: "wave2" };
}

export async function processMarketplaceAutoWorker(input: {
  baseUrl: string;
  now?: Date;
  batchSize?: number;
  wave2DelayMs?: number;
  deadlineMs?: number;
  actorId?: string;
  targetReferenceIds?: string[];
}): Promise<MarketplaceAutoWorkerResult | { ok: false; error: string }> {
  if (!marketplaceGuestInvitationEmailConfigured()) {
    return { ok: false, error: "email_configuration" };
  }

  const baseUrl = normalizedOrigin(input.baseUrl);
  if (!baseUrl) return { ok: false, error: "invalid_base_url" };

  const targetingRequested = (input.targetReferenceIds?.length ?? 0) > 0;
  const targetReferenceIds = normalizedTargetReferenceIds(input.targetReferenceIds);
  if (targetingRequested && targetReferenceIds.length === 0) {
    return { ok: false, error: "invalid_target" };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const batchSize = boundedInteger(input.batchSize, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);
  const wave2DelayMs = finiteDelayMs(input.wave2DelayMs);
  const deadlineMs = boundedInteger(input.deadlineMs, DEFAULT_WORKER_DEADLINE_MS, 1_000, 55_000);
  const deadlineAt = Date.now() + deadlineMs;
  const actorId = String(input.actorId ?? MARKETPLACE_AUTO_WORKER_ACTOR).trim() || MARKETPLACE_AUTO_WORKER_ACTOR;

  let rematchContext: MarketplaceRematchWorkerContext = new Map();
  if (targetReferenceIds.length === 0) {
    try {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) return { ok: false, error: "matching_failed" };
      rematchContext = await withTimeout(
        prepareMarketplaceRematchWork(batchSize),
        remaining,
        "Marketplace rematch pre-processing timed out",
      );
    } catch (error) {
      console.error("Marketplace rematch pre-processing failed", { error });
      return { ok: false, error: "matching_failed" };
    }
  }

  const priorityQuoteRequestIds = [...rematchContext.keys()];
  const result: MarketplaceAutoWorkerResult = {
    ok: true,
    scanned: 0,
    attempted: 0,
    sent: 0,
    wave1Sent: 0,
    wave2Sent: 0,
    deadlineReached: false,
    skipped: {},
  };

  let afterPriorityRank: number | null = null;
  let afterCreatedAt: string | null = null;
  let afterId: string | null = null;

  try {
    while (result.attempted < batchSize) {
      const remainingBeforeQueue = deadlineAt - Date.now();
      if (remainingBeforeQueue <= 0) {
        result.deadlineReached = true;
        break;
      }

      let queuePage: Awaited<ReturnType<typeof getMarketplaceAutoQueuePage>>;
      try {
        queuePage = await withTimeout(
          getMarketplaceAutoQueuePage({
            priorityQuoteRequestIds,
            onlyReferenceIds: targetReferenceIds,
            afterPriorityRank,
            afterCreatedAt,
            afterId,
            limit: MARKETPLACE_AUTO_QUEUE_PAGE_SIZE,
          }),
          remainingBeforeQueue,
          "Marketplace Auto Worker queue read timed out",
        );
      } catch (error) {
        console.error("Marketplace Auto Worker queue read failed", { error });
        return { ok: false, error: "matching_failed" };
      }
      if (!queuePage.ok) return { ok: false, error: "matching_failed" };
      if (queuePage.rows.length === 0) break;

      const quoteRequestIds = queuePage.rows.map((row) => row.quoteRequestId);
      const remainingBeforeSummaries = deadlineAt - Date.now();
      if (remainingBeforeSummaries <= 0) {
        result.deadlineReached = true;
        break;
      }

      let invitationSummaries: Awaited<ReturnType<typeof getMarketplaceInvitationSummaries>>;
      try {
        invitationSummaries = await withTimeout(
          getMarketplaceInvitationSummaries(quoteRequestIds),
          remainingBeforeSummaries,
          "Marketplace invitation-state pre-processing timed out",
        );
      } catch (error) {
        console.error("Marketplace Auto Worker invitation-state pre-processing failed", { error });
        return { ok: false, error: "matching_failed" };
      }

      for (const queueRow of queuePage.rows) {
        if (result.attempted >= batchSize) break;
        if (Date.now() >= deadlineAt) {
          result.deadlineReached = true;
          break;
        }
        result.scanned += 1;

        const invitationSummary = invitationSummaries.get(queueRow.quoteRequestId);
        if (!invitationSummary) {
          increment(result.skipped, "missing_invitation_state");
          continue;
        }

        const preliminaryDecision = decideMarketplaceAutoWave({
          invitationSummary,
          submittedOfferCount: queueRow.submittedOfferCount,
          nowMs,
          wave2DelayMs,
        });
        if (!preliminaryDecision.wave) {
          increment(result.skipped, preliminaryDecision.reason);
          continue;
        }

        const remainingBeforeMatch = deadlineAt - Date.now();
        if (remainingBeforeMatch <= 0) {
          result.deadlineReached = true;
          break;
        }

        let matchResult: Awaited<ReturnType<typeof getDirectoryGuestLeadMatch>>;
        try {
          matchResult = await withTimeout(
            getDirectoryGuestLeadMatch(queueRow.quoteRequestId),
            remainingBeforeMatch,
            "Marketplace single-request matching timed out",
          );
        } catch (error) {
          console.error("Marketplace Auto Worker single-request matching failed", {
            quoteRequestId: queueRow.quoteRequestId,
            error,
          });
          return { ok: false, error: "matching_failed" };
        }
        if (!matchResult.ok) return { ok: false, error: "matching_failed" };
        if (!matchResult.match) {
          increment(result.skipped, "quote_closed");
          continue;
        }

        const routedMatch = applyMarketplaceRematchContext([matchResult.match], rematchContext)[0];
        if (!routedMatch) {
          increment(result.skipped, "matching_failed");
          continue;
        }
        const freshOfferCount = submittedOfferCount(routedMatch.offers);
        const decision = decideMarketplaceAutoWave({
          invitationSummary,
          submittedOfferCount: freshOfferCount,
          nowMs,
          wave2DelayMs,
        });
        if (!decision.wave) {
          increment(result.skipped, decision.reason);
          continue;
        }

        const plan = planMarketplaceGuestWave({
          requestedWave: decision.wave,
          candidates: routedMatch.candidates,
          invitationSummary,
          submittedOfferCount: freshOfferCount,
        });
        if (plan.reason !== "ready") {
          increment(result.skipped, `plan_${plan.reason}`);
          continue;
        }

        result.attempted += 1;
        for (const candidate of plan.candidates) {
          const remainingBeforeStateUpdate = deadlineAt - Date.now();
          if (remainingBeforeStateUpdate <= 0) {
            result.deadlineReached = true;
            break;
          }

          try {
            await withTimeout(
              expirePastMarketplaceInvitation(queueRow.quoteRequestId, candidate.profileId),
              Math.min(INVITATION_STATE_TIMEOUT_MS, remainingBeforeStateUpdate),
              "Marketplace invitation state update timed out",
            );

            const remainingBeforeSend = deadlineAt - Date.now();
            if (remainingBeforeSend <= 0) {
              result.deadlineReached = true;
              break;
            }

            const sent = await withTimeout(
              sendMarketplaceGuestQuoteInvitation({
                quoteRequestId: queueRow.quoteRequestId,
                profileId: candidate.profileId,
                recipientEmail: candidate.recipientEmail,
                adminUserId: actorId,
                baseUrl,
                wave: decision.wave,
                matchScore: candidate.score,
                matchReasons: candidate.reasons,
              }),
              Math.min(INVITATION_SEND_TIMEOUT_MS, remainingBeforeSend),
              "Marketplace invitation delivery timed out",
            );

            if (sent.ok) {
              result.sent += 1;
              if (decision.wave === 1) result.wave1Sent += 1;
              else result.wave2Sent += 1;
            } else {
              increment(result.skipped, `delivery_${sent.code}`);
            }
          } catch (error) {
            increment(result.skipped, "delivery_error");
            if (Date.now() >= deadlineAt) result.deadlineReached = true;
            console.error("Marketplace Auto Worker invitation failed", {
              quoteRequestId: queueRow.quoteRequestId,
              profileId: candidate.profileId,
              wave: decision.wave,
              error,
            });
          }

          if (result.deadlineReached) break;
        }

        if (result.deadlineReached) break;
      }

      if (result.deadlineReached || result.attempted >= batchSize) break;
      const lastRow: MarketplaceAutoQueueRow | undefined = queuePage.rows[queuePage.rows.length - 1];
      if (!lastRow || queuePage.rows.length < MARKETPLACE_AUTO_QUEUE_PAGE_SIZE) break;
      afterPriorityRank = lastRow.priorityRank;
      afterCreatedAt = lastRow.createdAt;
      afterId = lastRow.quoteRequestId;
    }

    return result;
  } finally {
    try {
      await withTimeout(
        finalizeMarketplaceRematchWork(rematchContext),
        REMATCH_FINALIZE_TIMEOUT_MS,
        "Marketplace rematch finalization timed out",
      );
    } catch (error) {
      increment(result.skipped, "rematch_finalize_error");
      console.error("Marketplace rematch finalization failed", { error });
    }
  }
}
