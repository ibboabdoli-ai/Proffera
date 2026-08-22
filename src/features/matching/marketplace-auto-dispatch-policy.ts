import type { MarketplaceLeadInvitationSummary } from "./marketplace-invitation-state";

export const MARKETPLACE_WAVE2_WAIT_MS = 24 * 60 * 60 * 1000;

export type MarketplaceAutomaticWaveDecision = {
  wave: 1 | 2 | null;
  reason: "wave1" | "wave2" | "enough_offers" | "wave2_wait" | "complete" | "invalid_wave1_time";
};

export function decideMarketplaceAutomaticWave(input: {
  invitationSummary: MarketplaceLeadInvitationSummary;
  submittedOfferCount: number;
  latestWave1AttemptAt: string;
  nowMs?: number;
  wave2WaitMs?: number;
}): MarketplaceAutomaticWaveDecision {
  const { invitationSummary } = input;

  if (input.submittedOfferCount >= 2) {
    return { wave: null, reason: "enough_offers" };
  }
  if (invitationSummary.totalCount >= 5 || invitationSummary.wave2Count >= 2) {
    return { wave: null, reason: "complete" };
  }
  if (invitationSummary.wave1Count < 3) {
    return { wave: 1, reason: "wave1" };
  }

  const latestWave1AtMs = Date.parse(input.latestWave1AttemptAt);
  if (!Number.isFinite(latestWave1AtMs)) {
    return { wave: null, reason: "invalid_wave1_time" };
  }

  const nowMs = input.nowMs ?? Date.now();
  const waitMs = Math.max(0, input.wave2WaitMs ?? MARKETPLACE_WAVE2_WAIT_MS);
  if (latestWave1AtMs > nowMs || nowMs - latestWave1AtMs < waitMs) {
    return { wave: null, reason: "wave2_wait" };
  }

  return { wave: 2, reason: "wave2" };
}
