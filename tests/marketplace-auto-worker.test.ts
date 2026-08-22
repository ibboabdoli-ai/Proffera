import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emailConfigured: vi.fn(),
  getMatches: vi.fn(),
  getSummaries: vi.fn(),
  expireInvitation: vi.fn(),
  sendInvitation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  marketplaceGuestInvitationEmailConfigured: mocks.emailConfigured,
}));
vi.mock("@/features/matching/directory-guest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/matching/directory-guest")>();
  return { ...actual, getDirectoryGuestLeadMatches: mocks.getMatches };
});
vi.mock("@/features/matching/marketplace-invitation-state", () => ({
  getMarketplaceInvitationSummaries: mocks.getSummaries,
  expirePastMarketplaceInvitation: mocks.expireInvitation,
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  sendMarketplaceGuestQuoteInvitation: mocks.sendInvitation,
}));

import {
  DEFAULT_MARKETPLACE_WAVE2_DELAY_MS,
  MARKETPLACE_AUTO_WORKER_ACTOR,
  decideMarketplaceAutoWave,
  processMarketplaceAutoWorker,
} from "@/lib/marketplace-auto-worker";

function candidate(index: number, overrides: Record<string, unknown> = {}) {
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
    serviceAreaRadiusKm: 25,
    serviceAreaConfirmed: true,
    recipientEmail: `offert${index}@company.se`,
    contactBasis: "official_business_register" as const,
    ...overrides,
  };
}

function match(overrides: Record<string, unknown> = {}) {
  return {
    lead: {
      id: "11111111-1111-4111-8111-111111111111",
      reference_id: "QR-1",
      category: "VVS",
      service_type: "Rörmokare",
      city: "Södertälje",
      postal_code: "15100",
      description: "Leak",
      status: "submitted",
      customer_latitude: 59.2,
      customer_longitude: 17.6,
      created_at: "2026-08-22T08:00:00.000Z",
    },
    candidates: [candidate(1), candidate(2), candidate(3), candidate(4)],
    offers: [],
    radiusKm: 10,
    ...overrides,
  };
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    wave1Count: 0,
    wave2Count: 0,
    totalCount: 0,
    byProfile: new Map(),
    latestWave1At: null,
    ...overrides,
  };
}

describe("Marketplace Auto Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emailConfigured.mockReturnValue(true);
    mocks.getMatches.mockResolvedValue({ ok: true, matches: [match()] });
    mocks.getSummaries.mockResolvedValue(new Map([["11111111-1111-4111-8111-111111111111", summary()]]));
    mocks.expireInvitation.mockResolvedValue(undefined);
    mocks.sendInvitation.mockResolvedValue({ ok: true, invitationId: "invite-id" });
  });

  it("sends Wave 1 to at most three safe candidates using the system audit actor", async () => {
    const result = await processMarketplaceAutoWorker({ baseUrl: "https://preview.proffera.test" });

    expect(result).toMatchObject({ ok: true, attempted: 1, sent: 3, wave1Sent: 3, wave2Sent: 0 });
    expect(mocks.sendInvitation).toHaveBeenCalledTimes(3);
    expect(mocks.sendInvitation).toHaveBeenCalledWith(expect.objectContaining({
      adminUserId: MARKETPLACE_AUTO_WORKER_ACTOR,
      wave: 1,
      baseUrl: "https://preview.proffera.test",
    }));
  });

  it("waits before Wave 2 and sends nothing during the delay window", async () => {
    const invitationSummary = summary({
      wave1Count: 3,
      totalCount: 3,
      latestWave1At: "2026-08-22T10:00:00.000Z",
    });
    mocks.getSummaries.mockResolvedValue(new Map([["11111111-1111-4111-8111-111111111111", invitationSummary]]));

    const result = await processMarketplaceAutoWorker({
      baseUrl: "https://preview.proffera.test",
      now: new Date("2026-08-22T12:00:00.000Z"),
    });

    expect(result).toMatchObject({ ok: true, sent: 0, skipped: { wave2_waiting: 1 } });
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("sends Wave 2 to at most two new candidates after the delay when fewer than two offers exist", async () => {
    const invitationSummary = summary({
      wave1Count: 3,
      totalCount: 3,
      latestWave1At: "2026-08-22T10:00:00.000Z",
    });
    mocks.getSummaries.mockResolvedValue(new Map([["11111111-1111-4111-8111-111111111111", invitationSummary]]));
    mocks.getMatches.mockResolvedValue({
      ok: true,
      matches: [match({
        candidates: [candidate(4), candidate(5), candidate(6)],
        offers: [{ status: "submitted" }],
      })],
    });

    const result = await processMarketplaceAutoWorker({
      baseUrl: "https://preview.proffera.test",
      now: new Date("2026-08-22T17:00:00.000Z"),
    });

    expect(result).toMatchObject({ ok: true, attempted: 1, sent: 2, wave1Sent: 0, wave2Sent: 2 });
    expect(mocks.sendInvitation).toHaveBeenCalledTimes(2);
    expect(mocks.sendInvitation).toHaveBeenCalledWith(expect.objectContaining({ wave: 2 }));
  });

  it("never sends Wave 2 once two submitted or selected offers exist", async () => {
    mocks.getSummaries.mockResolvedValue(new Map([["11111111-1111-4111-8111-111111111111", summary({
      wave1Count: 3,
      totalCount: 3,
      latestWave1At: "2026-08-22T08:00:00.000Z",
    })]]));
    mocks.getMatches.mockResolvedValue({
      ok: true,
      matches: [match({ offers: [{ status: "submitted" }, { status: "selected" }] })],
    });

    const result = await processMarketplaceAutoWorker({
      baseUrl: "https://preview.proffera.test",
      now: new Date("2026-08-22T20:00:00.000Z"),
    });

    expect(result).toMatchObject({ ok: true, sent: 0, skipped: { enough_offers: 1 } });
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("fails closed before matching when transactional email is not configured", async () => {
    mocks.emailConfigured.mockReturnValue(false);

    await expect(processMarketplaceAutoWorker({ baseUrl: "https://preview.proffera.test" }))
      .resolves.toEqual({ ok: false, error: "email_configuration" });
    expect(mocks.getMatches).not.toHaveBeenCalled();
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("does not send candidates with unsafe contact basis", async () => {
    mocks.getMatches.mockResolvedValue({
      ok: true,
      matches: [match({ candidates: [candidate(1, { contactBasis: null, recipientEmail: "person@gmail.com" })] })],
    });

    const result = await processMarketplaceAutoWorker({ baseUrl: "https://preview.proffera.test" });

    expect(result).toMatchObject({ ok: true, sent: 0, skipped: { plan_no_safe_contacts: 1 } });
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("keeps the Wave 2 delay decision fail-closed when the Wave 1 timestamp is unavailable", () => {
    expect(decideMarketplaceAutoWave({
      invitationSummary: summary({ wave1Count: 3, totalCount: 3 }),
      submittedOfferCount: 0,
      nowMs: Date.parse("2026-08-22T20:00:00.000Z"),
      wave2DelayMs: DEFAULT_MARKETPLACE_WAVE2_DELAY_MS,
    })).toEqual({ wave: null, reason: "wave2_waiting" });
  });
});
