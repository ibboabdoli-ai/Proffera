import { describe, expect, it } from "vitest";

import type { DirectoryGuestCandidate } from "./directory-guest";
import type { MarketplaceLeadInvitationSummary } from "./marketplace-invitation-state";
import { planMarketplaceGuestWave } from "./marketplace-wave-plan";

function candidate(index: number, overrides: Partial<DirectoryGuestCandidate> = {}): DirectoryGuestCandidate {
  return {
    profileId: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
    slug: `company-${index}`,
    companyName: `Company ${index}`,
    city: "Södertälje",
    municipality: "Södertälje",
    serviceSlug: "vvs",
    serviceName: "VVS / Rörmokare",
    serviceCategory: "VVS",
    qualityScore: 95,
    score: 95,
    reasons: ["tjänstmatch"],
    distanceKm: 5,
    serviceAreaRadiusKm: null,
    serviceAreaConfirmed: false,
    recipientEmail: `offert${index}@company.se`,
    contactBasis: "official_business_register",
    ...overrides,
  };
}

function summary(overrides: Partial<MarketplaceLeadInvitationSummary> = {}): MarketplaceLeadInvitationSummary {
  return {
    wave1Count: 0,
    wave2Count: 0,
    totalCount: 0,
    byProfile: new Map(),
    latestWave1At: null,
    ...overrides,
  };
}

describe("marketplace 3+2 wave planner", () => {
  it("selects at most three safe candidates for Wave 1", () => {
    const plan = planMarketplaceGuestWave({
      requestedWave: 1,
      candidates: [candidate(1), candidate(2), candidate(3), candidate(4)],
      invitationSummary: summary(),
      submittedOfferCount: 0,
    });

    expect(plan.reason).toBe("ready");
    expect(plan.candidates).toHaveLength(3);
  });

  it("refuses Wave 2 before three Wave 1 slots have been used", () => {
    const plan = planMarketplaceGuestWave({
      requestedWave: 2,
      candidates: [candidate(1), candidate(2)],
      invitationSummary: summary({ wave1Count: 2, totalCount: 2 }),
      submittedOfferCount: 0,
    });

    expect(plan).toMatchObject({ reason: "wave1_first", candidates: [] });
  });

  it("does not send Wave 2 when two offers are already available", () => {
    const plan = planMarketplaceGuestWave({
      requestedWave: 2,
      candidates: [candidate(4), candidate(5)],
      invitationSummary: summary({ wave1Count: 3, totalCount: 3 }),
      submittedOfferCount: 2,
    });

    expect(plan).toMatchObject({ reason: "enough_offers", candidates: [] });
  });

  it("selects at most two new candidates for Wave 2", () => {
    const usedProfile = candidate(1);
    const byProfile = new Map([[usedProfile.profileId, {
      status: "sent",
      wave: 1 as const,
      blocking: true,
      expiresAt: "2026-08-30",
      recipientEmail: usedProfile.recipientEmail,
    }]]);
    const plan = planMarketplaceGuestWave({
      requestedWave: 2,
      candidates: [usedProfile, candidate(4), candidate(5), candidate(6)],
      invitationSummary: summary({ wave1Count: 3, totalCount: 3, byProfile }),
      submittedOfferCount: 1,
    });

    expect(plan.reason).toBe("ready");
    expect(plan.candidates.map((item) => item.companyName)).toEqual(["Company 4", "Company 5"]);
  });

  it("never exceeds the five total invitation slots", () => {
    const plan = planMarketplaceGuestWave({
      requestedWave: 1,
      candidates: [candidate(1), candidate(2), candidate(3)],
      invitationSummary: summary({ wave1Count: 0, wave2Count: 2, totalCount: 4 }),
      submittedOfferCount: 0,
    });

    expect(plan.reason).toBe("ready");
    expect(plan.candidates).toHaveLength(1);
  });

  it("never auto-selects weak, unsafe-basis, or already invited candidates", () => {
    const invited = candidate(1);
    const byProfile = new Map([[invited.profileId, {
      status: "sent",
      wave: 1 as const,
      blocking: true,
      expiresAt: "2026-08-30",
      recipientEmail: invited.recipientEmail,
    }]]);
    const plan = planMarketplaceGuestWave({
      requestedWave: 1,
      candidates: [
        invited,
        candidate(2, { score: 60 }),
        candidate(3, { recipientEmail: "", contactBasis: null }),
        candidate(4, { recipientEmail: "offert4@company.se", contactBasis: null }),
      ],
      invitationSummary: summary({ byProfile }),
      submittedOfferCount: 0,
    });

    expect(plan).toMatchObject({ reason: "no_safe_contacts", candidates: [] });
  });

  it("does not send twice to the same normalized mailbox across profiles or waves", () => {
    const usedProfile = candidate(1, { recipientEmail: "Shared@Company.se" });
    const byProfile = new Map([[usedProfile.profileId, {
      status: "sent",
      wave: 1 as const,
      blocking: true,
      expiresAt: "2026-08-30",
      recipientEmail: usedProfile.recipientEmail,
    }]]);
    const plan = planMarketplaceGuestWave({
      requestedWave: 2,
      candidates: [
        candidate(4, { recipientEmail: " shared@company.se " }),
        candidate(5, { recipientEmail: "new@company.se" }),
        candidate(6, { recipientEmail: "NEW@company.se" }),
      ],
      invitationSummary: summary({ wave1Count: 3, totalCount: 3, byProfile }),
      submittedOfferCount: 0,
    });

    expect(plan.reason).toBe("ready");
    expect(plan.candidates.map((item) => item.profileId)).toEqual([candidate(5).profileId]);
  });
});
