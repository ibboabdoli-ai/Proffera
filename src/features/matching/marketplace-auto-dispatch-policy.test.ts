import { describe, expect, it } from "vitest";

import type { MarketplaceLeadInvitationSummary } from "./marketplace-invitation-state";
import {
  decideMarketplaceAutomaticWave,
  MARKETPLACE_WAVE2_WAIT_MS,
} from "./marketplace-auto-dispatch-policy";

function summary(overrides: Partial<MarketplaceLeadInvitationSummary> = {}): MarketplaceLeadInvitationSummary {
  return {
    wave1Count: 0,
    wave2Count: 0,
    totalCount: 0,
    byProfile: new Map(),
    ...overrides,
  };
}

describe("Marketplace automatic dispatch policy", () => {
  it("fills Wave 1 first but stops outreach as soon as two offers exist", () => {
    expect(decideMarketplaceAutomaticWave({
      invitationSummary: summary({ wave1Count: 1, totalCount: 1 }),
      submittedOfferCount: 0,
      latestWave1AttemptAt: "",
    })).toEqual({ wave: 1, reason: "wave1" });

    expect(decideMarketplaceAutomaticWave({
      invitationSummary: summary({ wave1Count: 1, totalCount: 1 }),
      submittedOfferCount: 2,
      latestWave1AttemptAt: "",
    })).toEqual({ wave: null, reason: "enough_offers" });
  });

  it("waits 24 hours after the latest Wave 1 attempt before opening Wave 2", () => {
    const nowMs = Date.parse("2026-08-22T12:00:00Z");
    const latestWave1AttemptAt = new Date(nowMs - MARKETPLACE_WAVE2_WAIT_MS + 1).toISOString();

    expect(decideMarketplaceAutomaticWave({
      invitationSummary: summary({ wave1Count: 3, totalCount: 3 }),
      submittedOfferCount: 1,
      latestWave1AttemptAt,
      nowMs,
    })).toEqual({ wave: null, reason: "wave2_wait" });
  });

  it("opens Wave 2 after the wait when fewer than two offers exist", () => {
    const nowMs = Date.parse("2026-08-22T12:00:00Z");
    const latestWave1AttemptAt = new Date(nowMs - MARKETPLACE_WAVE2_WAIT_MS).toISOString();

    expect(decideMarketplaceAutomaticWave({
      invitationSummary: summary({ wave1Count: 3, totalCount: 3 }),
      submittedOfferCount: 1,
      latestWave1AttemptAt,
      nowMs,
    })).toEqual({ wave: 2, reason: "wave2" });
  });

  it("fails closed when Wave 1 history is missing or the 3+2 cap is complete", () => {
    expect(decideMarketplaceAutomaticWave({
      invitationSummary: summary({ wave1Count: 3, totalCount: 3 }),
      submittedOfferCount: 0,
      latestWave1AttemptAt: "",
    })).toEqual({ wave: null, reason: "invalid_wave1_time" });

    expect(decideMarketplaceAutomaticWave({
      invitationSummary: summary({ wave1Count: 3, wave2Count: 2, totalCount: 5 }),
      submittedOfferCount: 0,
      latestWave1AttemptAt: "2026-08-20T00:00:00Z",
    })).toEqual({ wave: null, reason: "complete" });
  });
});
