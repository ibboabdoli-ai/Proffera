import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  submitCore: vi.fn(),
  buildView: vi.fn(),
  hashToken: vi.fn(),
  validToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  buildMarketplaceGuestQuoteView: mocks.buildView,
  hashMarketplaceGuestToken: mocks.hashToken,
  submitMarketplaceGuestQuote: mocks.submitCore,
}));
vi.mock("@/lib/marketplace-guest-opt-out-core", () => ({
  isValidMarketplaceGuestToken: mocks.validToken,
}));

import {
  getMarketplaceGuestQuoteView,
  submitMarketplaceGuestQuote,
} from "@/lib/marketplace-guest-quote-human-view";

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("marketplace guest human-view tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validToken.mockReturnValue(true);
    mocks.hashToken.mockReturnValue("token-hash");
    mocks.buildView.mockImplementation((row: Record<string, unknown>) => ({
      status: String(row.status),
    }));
  });

  it("does not transition sent -> viewed when a guest page is fetched", async () => {
    const sql = vi.fn(async () => [{
      invitation_id: "11111111-1111-4111-8111-111111111111",
      status: "sent",
      expires_at: "2099-01-01T00:00:00.000Z",
      recipient_suppressed: false,
      quote_status: "submitted",
      display_name: "Rör AB",
      public_slug: "ror-ab",
      reference_id: "PF-1234",
      category: "VVS",
      service_type: "VVS / Rörmokare",
      city: "Södertälje",
      postal_code: "151 00",
      description: "Behöver hjälp.",
      contact_name: "Anna Andersson",
      contact_email: "anna@example.se",
      contact_phone: "0701234567",
      preferred_date: "2026-08-25",
      price_kind: null,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const view = await getMarketplaceGuestQuoteView("a".repeat(40));

    expect(view?.status).toBe("sent");
    expect(sql).toHaveBeenCalledTimes(1);
    expect(queryText(sql.mock.calls[0])).toContain("where i.token_hash =");
    expect(sql.mock.calls.some((call) => queryText(call).includes("set status = 'viewed'"))).toBe(false);
  });

  it("backfills viewed_at only after a successful human response", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);
    mocks.submitCore.mockResolvedValue({ ok: true, offerId: "offer-1" });

    const result = await submitMarketplaceGuestQuote({
      token: "b".repeat(40),
      priceKind: "fixed",
      amountMinor: 180000,
      availableDate: "2026-08-29",
      companyNote: "Test",
    });

    expect(result).toEqual({ ok: true, offerId: "offer-1" });
    expect(sql).toHaveBeenCalledTimes(1);
    const update = queryText(sql.mock.calls[0]);
    expect(update).toContain("viewed_at = coalesce(viewed_at, now())");
    expect(update).toContain("status = 'responded'");
  });

  it("does not write view analytics when the response fails", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);
    mocks.submitCore.mockResolvedValue({ ok: false, code: "closed" });

    const result = await submitMarketplaceGuestQuote({
      token: "c".repeat(40),
      priceKind: "fixed",
      amountMinor: 180000,
      availableDate: "2026-08-29",
      companyNote: "Test",
    });

    expect(result).toEqual({ ok: false, code: "closed" });
    expect(sql).not.toHaveBeenCalled();
  });
});
