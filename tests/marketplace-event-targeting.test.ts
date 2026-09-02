import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emailConfigured: vi.fn(),
  getQueuePage: vi.fn(),
  getMatch: vi.fn(),
  getSummaries: vi.fn(),
  prepareRematch: vi.fn(),
  applyRematch: vi.fn(),
  finalizeRematch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  marketplaceGuestInvitationEmailConfigured: mocks.emailConfigured,
}));
vi.mock("@/features/matching/marketplace-auto-queue", () => ({
  MARKETPLACE_AUTO_QUEUE_PAGE_SIZE: 50,
  getMarketplaceAutoQueuePage: mocks.getQueuePage,
}));
vi.mock("@/features/matching/directory-guest-single", () => ({
  getDirectoryGuestLeadMatch: mocks.getMatch,
}));
vi.mock("@/features/matching/marketplace-invitation-state", () => ({
  getMarketplaceInvitationSummaries: mocks.getSummaries,
  expirePastMarketplaceInvitation: vi.fn(),
}));
vi.mock("@/features/matching/marketplace-wave-plan", () => ({
  planMarketplaceGuestWave: vi.fn(),
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  sendMarketplaceGuestQuoteInvitation: vi.fn(),
}));
vi.mock("@/lib/marketplace-rematch-worker", () => ({
  prepareMarketplaceRematchWork: mocks.prepareRematch,
  applyMarketplaceRematchContext: mocks.applyRematch,
  finalizeMarketplaceRematchWork: mocks.finalizeRematch,
}));

import { processMarketplaceAutoWorker } from "@/lib/marketplace-auto-worker";

describe("Marketplace event targeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emailConfigured.mockReturnValue(true);
    mocks.getQueuePage.mockResolvedValue({ ok: true, rows: [] });
    mocks.prepareRematch.mockResolvedValue(new Map());
    mocks.applyRematch.mockImplementation((matches) => matches);
    mocks.finalizeRematch.mockResolvedValue(undefined);
  });

  it("restricts an event kick to the new reference and does not claim unrelated rematches", async () => {
    const result = await processMarketplaceAutoWorker({
      baseUrl: "https://www.proffera.se",
      targetReferenceIds: ["PRO-ABC123-XYZ99"],
    });

    expect(result).toMatchObject({ ok: true, scanned: 0, attempted: 0, sent: 0 });
    expect(mocks.prepareRematch).not.toHaveBeenCalled();
    expect(mocks.getQueuePage).toHaveBeenCalledWith(expect.objectContaining({
      onlyReferenceIds: ["PRO-ABC123-XYZ99"],
    }));
  });

  it("fails closed instead of falling back to the whole queue for an invalid target", async () => {
    const result = await processMarketplaceAutoWorker({
      baseUrl: "https://www.proffera.se",
      targetReferenceIds: ["not-a-valid-reference"],
    });

    expect(result).toEqual({ ok: false, error: "invalid_target" });
    expect(mocks.prepareRematch).not.toHaveBeenCalled();
    expect(mocks.getQueuePage).not.toHaveBeenCalled();
  });
});
