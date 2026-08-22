import { MIN_AUTOMATION_SCORE, type DirectoryGuestCandidate } from "./directory-guest";
import type { MarketplaceLeadInvitationSummary } from "./marketplace-invitation-state";

export type MarketplaceWavePlan = {
  wave: 1 | 2;
  candidates: DirectoryGuestCandidate[];
  reason: "ready" | "wave1_first" | "enough_offers" | "wave_full" | "no_safe_contacts";
};

export function planMarketplaceGuestWave(input: {
  requestedWave: 1 | 2;
  candidates: DirectoryGuestCandidate[];
  invitationSummary: MarketplaceLeadInvitationSummary;
  submittedOfferCount: number;
}): MarketplaceWavePlan {
  const { requestedWave, candidates, invitationSummary } = input;

  if (requestedWave === 2 && invitationSummary.wave1Count < 3) {
    return { wave: 2, candidates: [], reason: "wave1_first" };
  }
  if (requestedWave === 2 && input.submittedOfferCount >= 2) {
    return { wave: 2, candidates: [], reason: "enough_offers" };
  }

  const usedInWave = requestedWave === 1 ? invitationSummary.wave1Count : invitationSummary.wave2Count;
  const waveLimit = requestedWave === 1 ? 3 : 2;
  const totalRemaining = Math.max(0, 5 - invitationSummary.totalCount);
  const availableSlots = Math.min(Math.max(0, waveLimit - usedInWave), totalRemaining);
  if (availableSlots === 0) {
    return { wave: requestedWave, candidates: [], reason: "wave_full" };
  }

  const safeCandidates = candidates.filter((candidate) => (
    candidate.score >= MIN_AUTOMATION_SCORE
    && Boolean(candidate.recipientEmail)
    && candidate.contactBasis === "official_business_register"
    && !invitationSummary.byProfile.has(candidate.profileId)
  ));
  if (safeCandidates.length === 0) {
    return { wave: requestedWave, candidates: [], reason: "no_safe_contacts" };
  }

  return {
    wave: requestedWave,
    candidates: safeCandidates.slice(0, availableSlots),
    reason: "ready",
  };
}
