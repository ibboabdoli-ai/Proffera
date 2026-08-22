import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminForArea: vi.fn(),
  emailConfigured: vi.fn(),
  getMatch: vi.fn(),
  getSummaries: vi.fn(),
  planWave: vi.fn(),
  expireInvitation: vi.fn(),
  sendInvitation: vi.fn(),
}));

vi.mock("@/lib/admin-authorization", () => ({ getAdminForArea: mocks.getAdminForArea }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({ marketplaceGuestInvitationEmailConfigured: mocks.emailConfigured }));
vi.mock("@/features/matching/directory-guest-single", () => ({ getDirectoryGuestLeadMatch: mocks.getMatch }));
vi.mock("@/features/matching/marketplace-invitation-state", () => ({
  getMarketplaceInvitationSummaries: mocks.getSummaries,
  expirePastMarketplaceInvitation: mocks.expireInvitation,
}));
vi.mock("@/features/matching/marketplace-wave-plan", () => ({ planMarketplaceGuestWave: mocks.planWave }));
vi.mock("@/lib/marketplace-guest-quote", () => ({ sendMarketplaceGuestQuoteInvitation: mocks.sendInvitation }));

import { POST } from "@/app/api/admin/marketplace/auto-invite/route";

const quoteRequestId = "11111111-1111-4111-8111-111111111111";
const candidate = {
  profileId: "22222222-2222-4222-8222-222222222222",
  recipientEmail: "offert@rorfirma.se",
  score: 92,
  reasons: ["tjänstmatch", "5.0 km bort"],
};

function request(wave = "1", origin: string | null = "https://www.proffera.se", id = quoteRequestId, secFetchSite?: string) {
  const form = new FormData();
  form.set("quoteRequestId", id);
  form.set("wave", wave);
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  if (secFetchSite) headers.set("sec-fetch-site", secFetchSite);
  return new Request("https://www.proffera.se/api/admin/marketplace/auto-invite", {
    method: "POST",
    headers,
    body: form,
  });
}

function inviteCode(response: Response) {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location ?? "https://www.proffera.se").searchParams.get("invite");
}

describe("automatic Marketplace wave route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminForArea.mockResolvedValue({ userId: "admin-user" });
    mocks.emailConfigured.mockReturnValue(true);
    mocks.getMatch.mockResolvedValue({
      ok: true,
      match: { lead: { id: quoteRequestId }, candidates: [candidate], offers: [], radiusKm: 10 },
    });
    mocks.getSummaries.mockResolvedValue(new Map([[quoteRequestId, { wave1Count: 0, wave2Count: 0, totalCount: 0, byProfile: new Map() }]]));
    mocks.planWave.mockReturnValue({ wave: 1, candidates: [candidate], reason: "ready" });
    mocks.expireInvitation.mockResolvedValue(undefined);
    mocks.sendInvitation.mockResolvedValue({ ok: true, invitationId: "invite-id" });
  });

  it("requires Quote Admin authorization and same-origin POST", async () => {
    mocks.getAdminForArea.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(403);

    mocks.getAdminForArea.mockResolvedValue({ userId: "admin-user" });
    expect((await POST(request("1", "https://evil.example"))).status).toBe(403);
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("uses sec-fetch-site as the same-origin fallback when Origin is absent", async () => {
    expect((await POST(request("1", null, quoteRequestId, "cross-site"))).status).toBe(403);
    expect(mocks.sendInvitation).not.toHaveBeenCalled();

    const response = await POST(request("1", null, quoteRequestId, "same-origin"));
    expect(inviteCode(response)).toBe("auto_wave_sent");
  });

  it("rejects invalid wave and quote request identifiers before matching", async () => {
    expect(inviteCode(await POST(request("3")))).toBe("invalid_wave");
    expect(inviteCode(await POST(request("1", "https://www.proffera.se", "not-a-uuid")))).toBe("invalid_wave");
    expect(mocks.getMatch).not.toHaveBeenCalled();
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("fails before matching or reservation when email delivery is not configured", async () => {
    mocks.emailConfigured.mockReturnValue(false);

    const response = await POST(request());

    expect(inviteCode(response)).toBe("email_configuration");
    expect(mocks.getMatch).not.toHaveBeenCalled();
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("loads only the requested quote and sends only candidates returned by the safe wave planner", async () => {
    const response = await POST(request("1"));

    expect(inviteCode(response)).toBe("auto_wave_sent");
    expect(mocks.getMatch).toHaveBeenCalledWith(quoteRequestId);
    expect(mocks.expireInvitation).toHaveBeenCalledWith(quoteRequestId, candidate.profileId);
    expect(mocks.sendInvitation).toHaveBeenCalledWith(expect.objectContaining({
      quoteRequestId,
      profileId: candidate.profileId,
      recipientEmail: candidate.recipientEmail,
      adminUserId: "admin-user",
      wave: 1,
      matchScore: 92,
      matchReasons: candidate.reasons,
    }));
  });

  it("contains expiration or delivery failures and reports no delivery", async () => {
    mocks.expireInvitation.mockRejectedValueOnce(new Error("database timeout"));
    expect(inviteCode(await POST(request("1")))).toBe("auto_no_delivery");
    expect(mocks.sendInvitation).not.toHaveBeenCalled();

    mocks.expireInvitation.mockResolvedValue(undefined);
    mocks.sendInvitation.mockResolvedValueOnce({ ok: false, code: "email_network" });
    expect(inviteCode(await POST(request("1")))).toBe("auto_no_delivery");

    mocks.sendInvitation.mockRejectedValueOnce(new Error("provider down"));
    expect(inviteCode(await POST(request("1")))).toBe("auto_no_delivery");
  });

  it("bounds a stalled provider call and continues with a no-delivery redirect", async () => {
    vi.useFakeTimers();
    try {
      mocks.sendInvitation.mockImplementation(() => new Promise(() => {}));
      const responsePromise = POST(request("1"));
      await vi.runAllTimersAsync();
      expect(inviteCode(await responsePromise)).toBe("auto_no_delivery");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the wave at the total dispatch deadline and preserves completed sends", async () => {
    const secondCandidate = {
      ...candidate,
      profileId: "33333333-3333-4333-8333-333333333333",
      recipientEmail: "offert@andra-firman.se",
    };
    mocks.planWave.mockReturnValue({ wave: 1, candidates: [candidate, secondCandidate], reason: "ready" });
    const now = vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(21_000);

    try {
      const response = await POST(request("1"));
      const location = new URL(response.headers.get("location") ?? "https://www.proffera.se");

      expect(location.searchParams.get("invite")).toBe("auto_wave_sent");
      expect(location.searchParams.get("sent")).toBe("1");
      expect(mocks.sendInvitation).toHaveBeenCalledTimes(1);
      expect(mocks.expireInvitation).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });

  it("does not send when the planner says Wave 2 is unnecessary", async () => {
    mocks.planWave.mockReturnValue({ wave: 2, candidates: [], reason: "enough_offers" });

    const response = await POST(request("2"));

    expect(inviteCode(response)).toBe("auto_enough_offers");
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });
});
