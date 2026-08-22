import "server-only";

import { marketplaceGuestInvitationEmailConfigured } from "@/features/email/marketplace-guest-invitation-email";
import { getDirectoryGuestLeadMatches } from "@/features/matching/directory-guest";
import {
  expirePastMarketplaceInvitation,
  getMarketplaceInvitationSummaries,
  type MarketplaceLeadInvitationSummary,
} from "@/features/matching/marketplace-invitation-state";
import { planMarketplaceGuestWave } from "@/features/matching/marketplace-wave-plan";
import { sendMarketplaceGuestQuoteInvitation } from "@/lib/marketplace-guest-quote";

export const MARKETPLACE_AUTO_WORKER_ACTOR = "system:marketplace-auto-worker";
export const DEFAULT_MARKETPLACE_WAVE2_DELAY_MS = 6 * 60 * 60 * 1000;

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 10;
const DEFAULT_WORKER_DEADLINE_MS = 45_000;
const INVITATION_STATE_TIMEOUT_MS = 3_000;
const INVITATION_SEND_TIMEOUT_MS = 8_000;

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

function normalizedOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function submittedOfferCount(offers: Array<{ status: string }>) {
  return offers.filter((offer) => offer.status === "submitted" || offer.status === "selected").length;
}

function increment(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function timestampMs(value: string | null | undefined) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
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
  if (invitationSummary.wave1Count < 3) return { wave: 1, reason: "wave1" };
  if (input.submittedOfferCount >= 2) return { wave: null, reason: "enough_offers" };
  if (invitationSummary.wave2Count >= 2 || invitationSummary.totalCount >= 5) {
    return { wave: null, reason: "wave_full" };
  }

  const latestWave1At = timestampMs(invitationSummary.latestWave1At);
  const delay = Math.max(0, input.wave2DelayMs);
  if (latestWave1At === null || input.nowMs - latestWave1At < delay) {
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
}): Promise<MarketplaceAutoWorkerResult | { ok: false; error: string }> {
  if (!marketplaceGuestInvitationEmailConfigured()) {
    return { ok: false, error: "email_configuration" };
  }

  const baseUrl = normalizedOrigin(input.baseUrl);
  if (!baseUrl) return { ok: false, error: "invalid_base_url" };

  const nowMs = (input.now ?? new Date()).getTime();
  const batchSize = boundedInteger(input.batchSize, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);
  const wave2DelayMs = Math.max(0, input.wave2DelayMs ?? DEFAULT_MARKETPLACE_WAVE2_DELAY_MS);
  const deadlineMs = boundedInteger(input.deadlineMs, DEFAULT_WORKER_DEADLINE_MS, 1_000, 55_000);
  const deadlineAt = Date.now() + deadlineMs;
  const actorId = String(input.actorId ?? MARKETPLACE_AUTO_WORKER_ACTOR).trim() || MARKETPLACE_AUTO_WORKER_ACTOR;

  const matchesResult = await getDirectoryGuestLeadMatches();
  if (!matchesResult.ok) return { ok: false, error: "matching_failed" };

  const matches = [...matchesResult.matches].sort((left, right) => {
    const leftTime = timestampMs(left.lead.created_at) ?? Number.MAX_SAFE_INTEGER;
    const rightTime = timestampMs(right.lead.created_at) ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime || left.lead.id.localeCompare(right.lead.id);
  });
  const quoteRequestIds = matches.map((match) => match.lead.id).filter(Boolean);
  const invitationSummaries = await getMarketplaceInvitationSummaries(quoteRequestIds);

  const result: MarketplaceAutoWorkerResult = {
    ok: true,
    scanned: matches.length,
    attempted: 0,
    sent: 0,
    wave1Sent: 0,
    wave2Sent: 0,
    deadlineReached: false,
    skipped: {},
  };

  for (const match of matches) {
    if (result.attempted >= batchSize) break;
    if (Date.now() >= deadlineAt) {
      result.deadlineReached = true;
      break;
    }

    const invitationSummary = invitationSummaries.get(match.lead.id);
    if (!invitationSummary) {
      increment(result.skipped, "missing_invitation_state");
      continue;
    }

    const offerCount = submittedOfferCount(match.offers);
    const decision = decideMarketplaceAutoWave({
      invitationSummary,
      submittedOfferCount: offerCount,
      nowMs,
      wave2DelayMs,
    });
    if (!decision.wave) {
      increment(result.skipped, decision.reason);
      continue;
    }

    const plan = planMarketplaceGuestWave({
      requestedWave: decision.wave,
      candidates: match.candidates,
      invitationSummary,
      submittedOfferCount: offerCount,
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
          expirePastMarketplaceInvitation(match.lead.id, candidate.profileId),
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
            quoteRequestId: match.lead.id,
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
        console.error("Marketplace Auto Worker invitation failed", {
          quoteRequestId: match.lead.id,
          profileId: candidate.profileId,
          wave: decision.wave,
          error,
        });
      }
    }

    if (result.deadlineReached) break;
  }

  return result;
}
