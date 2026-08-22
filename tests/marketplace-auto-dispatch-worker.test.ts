import { describe, expect, it, vi } from "vitest";

import type { DirectoryGuestCandidate, DirectoryGuestLeadMatch } from "@/features/matching/directory-guest";
import type { MarketplaceLeadInvitationSummary } from "@/features/matching/marketplace-invitation-state";
import { planMarketplaceGuestWave } from "@/features/matching/marketplace-wave-plan";
import {
  runMarketplaceAutoDispatch,
  type MarketplaceAutoDispatchDependencies,
} from "@/lib/marketplace-auto-dispatch-worker";

const quoteRequestId = "11111111-1111-4111-8111-111111111111";

function candidate(index: number): DirectoryGuestCandidate {
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
    reasons: ["tjänstmatch", "5.0 km bort"],
    distanceKm: 5,
    serviceAreaRadiusKm: 20,
    serviceAreaConfirmed: true,
    recipientEmail: `offert${index}@company.se`,
    contactBasis: "official_business_register",
  };
}

function match(offers: DirectoryGuestLeadMatch["offers"] = []): DirectoryGuestLeadMatch {
  return {
    lead: {
      id: quoteRequestId,
      reference_id: "QR-TEST",
      category: "VVS",
      service_type: "VVS / Rörmokare",
      city: "Södertälje",
      postal_code: "15100",
      description: "Test",
      status: "submitted",
      customer_latitude: 59.2,
      customer_longitude: 17.6,
      created_at: "2026-08-22T08:00:00Z",
    },
    candidates: [candidate(1), candidate(2), candidate(3), candidate(4), candidate(5)],
    offers,
    radiusKm: 10,
  };
}

function summary(overrides: Partial<MarketplaceLeadInvitationSummary> = {}): MarketplaceLeadInvitationSummary {
  return {
    wave1Count: 0,
    wave2Count: 0,
    totalCount: 0,
    byProfile: new Map(),
    ...overrides,
  };
}

function dependencies(input: {
  invitationSummary?: MarketplaceLeadInvitationSummary;
  latestWave1AttemptAt?: string;
  offers?: DirectoryGuestLeadMatch["offers"];
} = {}) {
  const sendInvitation = vi.fn().mockResolvedValue({ ok: true, invitationId: "invitation-id" });
  const deps: MarketplaceAutoDispatchDependencies = {
    emailConfigured: () => true,
    getMatches: async () => ({ ok: true as const, matches: [match(input.offers)] }),
    getSummaries: async () => new Map([[quoteRequestId, input.invitationSummary ?? summary()]]),
    getLatestWave1AttemptAt: async () => new Map(
      input.latestWave1AttemptAt ? [[quoteRequestId, input.latestWave1AttemptAt]] : [],
    ),
    planWave: planMarketplaceGuestWave,
    expireInvitation: vi.fn().mockResolvedValue(undefined),
    sendInvitation,
  };
  return { deps, sendInvitation };
}

describe("Marketplace automatic dispatch worker", () => {
  it("uses the existing safe planner and sender to fill Wave 1 with a system actor", async () => {
    const { deps, sendInvitation } = dependencies();

    const result = await runMarketplaceAutoDispatch({
      baseUrl: "https://www.proffera.se",
      now: new Date("2026-08-22T12:00:00Z"),
    }, deps);

    expect(result).toMatchObject({ ok: true, sent: 3, wave1Sent: 3, wave2Sent: 0, failures: 0 });
    expect(sendInvitation).toHaveBeenCalledTimes(3);
    expect(sendInvitation).toHaveBeenCalledWith(expect.objectContaining({
      quoteRequestId,
      adminUserId: "system:marketplace-auto-dispatch",
      baseUrl: "https://www.proffera.se",
      wave: 1,
    }));
  });

  it("does not open Wave 2 before the response window has elapsed", async () => {
    const now = new Date("2026-08-22T12:00:00Z");
    const { deps, sendInvitation } = dependencies({
      invitationSummary: summary({ wave1Count: 3, totalCount: 3 }),
      latestWave1AttemptAt: "2026-08-22T11:00:00Z",
    });

    const result = await runMarketplaceAutoDispatch({ baseUrl: "https://www.proffera.se", now }, deps);

    expect(result).toMatchObject({ ok: true, sent: 0 });
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  it("sends at most two new Wave 2 invitations after 24 hours when fewer than two offers exist", async () => {
    const used = new Map([
      [candidate(1).profileId, { status: "sent", wave: 1 as const, blocking: true, expiresAt: "2026-08-30" }],
      [candidate(2).profileId, { status: "sent", wave: 1 as const, blocking: true, expiresAt: "2026-08-30" }],
      [candidate(3).profileId, { status: "sent", wave: 1 as const, blocking: true, expiresAt: "2026-08-30" }],
    ]);
    const { deps, sendInvitation } = dependencies({
      invitationSummary: summary({ wave1Count: 3, totalCount: 3, byProfile: used }),
      latestWave1AttemptAt: "2026-08-21T11:00:00Z",
    });

    const result = await runMarketplaceAutoDispatch({
      baseUrl: "https://www.proffera.se",
      now: new Date("2026-08-22T12:00:00Z"),
    }, deps);

    expect(result).toMatchObject({ ok: true, sent: 2, wave1Sent: 0, wave2Sent: 2 });
    expect(sendInvitation).toHaveBeenCalledTimes(2);
    expect(sendInvitation).toHaveBeenCalledWith(expect.objectContaining({ wave: 2 }));
  });

  it("stops all further outreach once two offers exist", async () => {
    const offers = [1, 2].map((index) => ({
      offerId: `offer-${index}`,
      companyName: `Company ${index}`,
      profileSlug: `company-${index}`,
      status: "submitted",
      priceKind: "fixed",
      currency: "SEK",
      amountMinor: 10000,
      availableDate: "2026-08-30",
      companyNote: "",
      submittedAt: "2026-08-22T10:00:00Z",
    }));
    const { deps, sendInvitation } = dependencies({ offers });

    const result = await runMarketplaceAutoDispatch({ baseUrl: "https://www.proffera.se" }, deps);

    expect(result).toMatchObject({ ok: true, sent: 0 });
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  it("fails closed for non-HTTPS origins and missing email configuration", async () => {
    const { deps, sendInvitation } = dependencies();
    expect(await runMarketplaceAutoDispatch({ baseUrl: "http://www.proffera.se" }, deps))
      .toEqual({ ok: false, code: "invalid_base_url" });

    const disabledDeps = { ...deps, emailConfigured: () => false };
    expect(await runMarketplaceAutoDispatch({ baseUrl: "https://www.proffera.se" }, disabledDeps))
      .toEqual({ ok: false, code: "email_configuration" });
    expect(sendInvitation).not.toHaveBeenCalled();
  });
});
