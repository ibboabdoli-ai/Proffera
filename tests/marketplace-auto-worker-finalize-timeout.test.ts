import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emailConfigured: vi.fn(),
  getQueuePage: vi.fn(),
  getMatch: vi.fn(),
  getSummaries: vi.fn(),
  expireInvitation: vi.fn(),
  planWave: vi.fn(),
  sendInvitation: vi.fn(),
  prepareRematch: vi.fn(),
  applyRematch: vi.fn(),
  finalizeRematch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  marketplaceGuestInvitationEmailConfigured: mocks.emailConfigured,
}));
vi.mock("@/features/matching/marketplace-auto-queue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/matching/marketplace-auto-queue")>()),
  getMarketplaceAutoQueuePage: mocks.getQueuePage,
}));
vi.mock("@/features/matching/directory-guest-single", () => ({
  getDirectoryGuestLeadMatch: mocks.getMatch,
}));
vi.mock("@/features/matching/marketplace-invitation-state", () => ({
  getMarketplaceInvitationSummaries: mocks.getSummaries,
  expirePastMarketplaceInvitation: mocks.expireInvitation,
}));
vi.mock("@/features/matching/marketplace-wave-plan", () => ({
  planMarketplaceGuestWave: mocks.planWave,
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  sendMarketplaceGuestQuoteInvitation: mocks.sendInvitation,
}));
vi.mock("@/lib/marketplace-rematch-worker", () => ({
  prepareMarketplaceRematchWork: mocks.prepareRematch,
  applyMarketplaceRematchContext: mocks.applyRematch,
  finalizeMarketplaceRematchWork: mocks.finalizeRematch,
}));

import { processMarketplaceAutoWorker } from "@/lib/marketplace-auto-worker";

describe("Marketplace Auto Worker rematch finalization timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emailConfigured.mockReturnValue(true);
    mocks.prepareRematch.mockResolvedValue(new Map([
      ["22222222-2222-4222-8222-222222222222", {
        rematchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        sourceQuoteRequestId: "11111111-1111-4111-8111-111111111111",
        rematchQuoteRequestId: "22222222-2222-4222-8222-222222222222",
        excludedProfileIds: new Set(),
        excludedRecipientEmails: new Set(),
      }],
    ]));
    mocks.getQueuePage.mockResolvedValue({ ok: true, rows: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the accumulated result when rematch finalization stalls", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.finalizeRematch.mockImplementation(() => new Promise(() => {}));

    const resultPromise = processMarketplaceAutoWorker({
      baseUrl: "https://preview.proffera.test",
      deadlineMs: 10_000,
    });

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      scanned: 0,
      attempted: 0,
      sent: 0,
      wave1Sent: 0,
      wave2Sent: 0,
      deadlineReached: false,
      skipped: { rematch_finalize_error: 1 },
    });
    expect(mocks.finalizeRematch).toHaveBeenCalledTimes(1);
  });
});
