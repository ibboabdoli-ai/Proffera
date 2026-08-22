import "server-only";

import { marketplaceGuestInvitationEmailConfigured } from "@/features/email/marketplace-guest-invitation-email";
import {
  getDirectoryGuestLeadMatches,
  type DirectoryGuestLeadMatch,
} from "@/features/matching/directory-guest";
import {
  decideMarketplaceAutomaticWave,
  MARKETPLACE_WAVE2_WAIT_MS,
} from "@/features/matching/marketplace-auto-dispatch-policy";
import {
  expirePastMarketplaceInvitation,
  getMarketplaceInvitationSummaries,
  type MarketplaceLeadInvitationSummary,
} from "@/features/matching/marketplace-invitation-state";
import {
  planMarketplaceGuestWave,
  type MarketplaceWavePlan,
} from "@/features/matching/marketplace-wave-plan";
import { getSql } from "@/lib/db/server";
import { sendMarketplaceGuestQuoteInvitation } from "@/lib/marketplace-guest-quote";

const SYSTEM_ACTOR_ID = "system:marketplace-auto-dispatch";
const MAX_QUOTES_PER_RUN = 10;
const WORKER_DEADLINE_MS = 45_000;
const INVITATION_STATE_TIMEOUT_MS = 3_000;
const INVITATION_SEND_TIMEOUT_MS = 8_000;

export type MarketplaceAutoDispatchDependencies = {
  emailConfigured: () => boolean;
  getMatches: () => Promise<Awaited<ReturnType<typeof getDirectoryGuestLeadMatches>>>;
  getSummaries: (quoteRequestIds: string[]) => Promise<Map<string, MarketplaceLeadInvitationSummary>>;
  getLatestWave1AttemptAt: (quoteRequestIds: string[]) => Promise<Map<string, string>>;
  planWave: (input: Parameters<typeof planMarketplaceGuestWave>[0]) => MarketplaceWavePlan;
  expireInvitation: (quoteRequestId: string, profileId: string) => Promise<void>;
  sendInvitation: typeof sendMarketplaceGuestQuoteInvitation;
};

export type MarketplaceAutoDispatchResult = {
  ok: true;
  scanned: number;
  considered: number;
  attempted: number;
  sent: number;
  wave1Sent: number;
  wave2Sent: number;
  failures: number;
  stoppedByDeadline: boolean;
  skipped: Record<string, number>;
} | {
  ok: false;
  code: "invalid_base_url" | "email_configuration" | "matching_failed" | "database";
};

function safeHttpsOrigin(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

function boundedQuoteLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MAX_QUOTES_PER_RUN;
  return Math.max(1, Math.min(MAX_QUOTES_PER_RUN, Math.floor(parsed)));
}

function addSkip(skipped: Record<string, number>, reason: string) {
  skipped[reason] = (skipped[reason] ?? 0) + 1;
}

function submittedOfferCount(match: DirectoryGuestLeadMatch) {
  return match.offers.filter((offer) => offer.status === "submitted" || offer.status === "selected").length;
}

function chronological(matches: DirectoryGuestLeadMatch[]) {
  return [...matches].sort((left, right) => {
    const leftTime = Date.parse(left.lead.created_at);
    const rightTime = Date.parse(right.lead.created_at);
    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return left.lead.id.localeCompare(right.lead.id);
    if (!Number.isFinite(leftTime)) return 1;
    if (!Number.isFinite(rightTime)) return -1;
    return leftTime - rightTime || left.lead.id.localeCompare(right.lead.id);
  });
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

async function loadLatestWave1AttemptAt(quoteRequestIds: string[]) {
  const result = new Map<string, string>();
  if (quoteRequestIds.length === 0) return result;

  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const quoteRequestIdCsv = quoteRequestIds.join(",");
  const rows = await sql`
    select
      quote_request_id::text,
      max(coalesce(sent_at, created_at))::text as latest_wave1_attempt_at
    from marketplace_quote_invitations
    where quote_request_id = any(string_to_array(${quoteRequestIdCsv}, ',')::uuid[])
      and wave = 1
    group by quote_request_id
  `;

  for (const row of rows as Record<string, unknown>[]) {
    const quoteRequestId = String(row.quote_request_id ?? "");
    const latestAt = String(row.latest_wave1_attempt_at ?? "");
    if (quoteRequestId && latestAt) result.set(quoteRequestId, latestAt);
  }
  return result;
}

const defaultDependencies: MarketplaceAutoDispatchDependencies = {
  emailConfigured: marketplaceGuestInvitationEmailConfigured,
  getMatches: getDirectoryGuestLeadMatches,
  getSummaries: getMarketplaceInvitationSummaries,
  getLatestWave1AttemptAt: loadLatestWave1AttemptAt,
  planWave: planMarketplaceGuestWave,
  expireInvitation: expirePastMarketplaceInvitation,
  sendInvitation: sendMarketplaceGuestQuoteInvitation,
};

export async function runMarketplaceAutoDispatch(input: {
  baseUrl: string;
  now?: Date;
  maxQuotes?: number;
  wave2WaitMs?: number;
}, dependencies: MarketplaceAutoDispatchDependencies = defaultDependencies): Promise<MarketplaceAutoDispatchResult> {
  const baseUrl = safeHttpsOrigin(input.baseUrl);
  if (!baseUrl) return { ok: false, code: "invalid_base_url" };
  if (!dependencies.emailConfigured()) return { ok: false, code: "email_configuration" };

  const matchesResult = await dependencies.getMatches();
  if (!matchesResult.ok) return { ok: false, code: "matching_failed" };

  const maxQuotes = boundedQuoteLimit(input.maxQuotes);
  const selectedMatches = chronological(matchesResult.matches).slice(0, maxQuotes);
  const quoteRequestIds = selectedMatches.map((match) => match.lead.id);

  let summaries: Map<string, MarketplaceLeadInvitationSummary>;
  let latestWave1Attempts: Map<string, string>;
  try {
    [summaries, latestWave1Attempts] = await Promise.all([
      dependencies.getSummaries(quoteRequestIds),
      dependencies.getLatestWave1AttemptAt(quoteRequestIds),
    ]);
  } catch (error) {
    console.error("Marketplace auto dispatch failed to load invitation state", error);
    return { ok: false, code: "database" };
  }

  const result: Extract<MarketplaceAutoDispatchResult, { ok: true }> = {
    ok: true,
    scanned: matchesResult.matches.length,
    considered: selectedMatches.length,
    attempted: 0,
    sent: 0,
    wave1Sent: 0,
    wave2Sent: 0,
    failures: 0,
    stoppedByDeadline: false,
    skipped: {},
  };
  const nowMs = input.now?.getTime() ?? Date.now();
  const dispatchDeadline = Date.now() + WORKER_DEADLINE_MS;

  outer: for (const match of selectedMatches) {
    const summary = summaries.get(match.lead.id);
    if (!summary) {
      addSkip(result.skipped, "missing_invitation_summary");
      continue;
    }

    const decision = decideMarketplaceAutomaticWave({
      invitationSummary: summary,
      submittedOfferCount: submittedOfferCount(match),
      latestWave1AttemptAt: latestWave1Attempts.get(match.lead.id) ?? "",
      nowMs,
      wave2WaitMs: input.wave2WaitMs ?? MARKETPLACE_WAVE2_WAIT_MS,
    });
    if (decision.wave === null) {
      addSkip(result.skipped, decision.reason);
      continue;
    }

    const plan = dependencies.planWave({
      requestedWave: decision.wave,
      candidates: match.candidates,
      invitationSummary: summary,
      submittedOfferCount: submittedOfferCount(match),
    });
    if (plan.reason !== "ready") {
      addSkip(result.skipped, `planner_${plan.reason}`);
      continue;
    }

    for (const candidate of plan.candidates) {
      let remainingMs = dispatchDeadline - Date.now();
      if (remainingMs <= 0) {
        result.stoppedByDeadline = true;
        break outer;
      }

      try {
        await withTimeout(
          dependencies.expireInvitation(match.lead.id, candidate.profileId),
          Math.min(INVITATION_STATE_TIMEOUT_MS, remainingMs),
          "Marketplace invitation state update timed out",
        );

        remainingMs = dispatchDeadline - Date.now();
        if (remainingMs <= 0) {
          result.stoppedByDeadline = true;
          break outer;
        }

        result.attempted += 1;
        const sendResult = await withTimeout(
          dependencies.sendInvitation({
            quoteRequestId: match.lead.id,
            profileId: candidate.profileId,
            recipientEmail: candidate.recipientEmail,
            adminUserId: SYSTEM_ACTOR_ID,
            baseUrl,
            wave: decision.wave,
            matchScore: candidate.score,
            matchReasons: candidate.reasons,
          }),
          Math.min(INVITATION_SEND_TIMEOUT_MS, remainingMs),
          "Marketplace invitation delivery timed out",
        );

        if (sendResult.ok) {
          result.sent += 1;
          if (decision.wave === 1) result.wave1Sent += 1;
          else result.wave2Sent += 1;
        } else {
          result.failures += 1;
          addSkip(result.skipped, `send_${sendResult.code}`);
        }
      } catch (error) {
        result.failures += 1;
        addSkip(result.skipped, "dispatch_error");
        console.error("Marketplace automatic invitation failed", {
          quoteRequestId: match.lead.id,
          profileId: candidate.profileId,
          wave: decision.wave,
          error,
        });
      }
    }
  }

  return result;
}
