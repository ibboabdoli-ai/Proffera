import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  sendComparisonEmail: vi.fn(),
  hashGuestToken: vi.fn(),
  validGuestToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/email/marketplace-customer-comparison-email", () => ({
  sendMarketplaceCustomerComparisonEmail: mocks.sendComparisonEmail,
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  hashMarketplaceGuestToken: mocks.hashGuestToken,
}));
vi.mock("@/lib/marketplace-guest-opt-out-core", () => ({
  isValidMarketplaceGuestToken: mocks.validGuestToken,
}));

import {
  customerVisibleMarketplaceOfferNote,
  getMarketplaceCustomerComparison,
  hashMarketplaceCustomerComparisonToken,
  marketplaceCustomerComparisonPath,
  notifyMarketplaceCustomerOfferAvailableFromGuestToken,
  selectMarketplaceCustomerOffer,
} from "@/lib/marketplace-customer-comparison";

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? []);
}

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("marketplace customer comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validGuestToken.mockReturnValue(true);
    mocks.hashGuestToken.mockReturnValue("guest-token-hash");
  });

  it("hashes customer tokens and keeps the raw token only in the link", () => {
    const token = "a".repeat(43);
    expect(hashMarketplaceCustomerComparisonToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(marketplaceCustomerComparisonPath(token)).toBe(`/offert/jamfor/${token}`);
  });

  it("redacts provider email, phone and URL from notes before selection", () => {
    const source = "Ring 070-123 45 67, maila offert@rorfirma.se eller se https://rorfirma.se/pris";
    const hidden = customerVisibleMarketplaceOfferNote(source, false);
    expect(hidden.redacted).toBe(true);
    expect(hidden.note).not.toContain("070-123 45 67");
    expect(hidden.note).not.toContain("offert@rorfirma.se");
    expect(hidden.note).not.toContain("https://rorfirma.se/pris");
    expect(hidden.note).toContain("[…]");

    const unlocked = customerVisibleMarketplaceOfferNote(source, true);
    expect(unlocked).toEqual({ note: source, redacted: false });
  });

  it("never projects provider email for submitted offers and unlocks it only for the selected offer", async () => {
    const sql = sqlResponses(
      [{
        quote_request_id: "11111111-1111-4111-8111-111111111111",
        reference_id: "PRO-123",
        service_type: "Rörmokare",
        city: "Södertälje",
        preferred_date: "2026-09-01",
        quote_status: "booked",
      }],
      [
        {
          id: "22222222-2222-4222-8222-222222222222",
          status: "selected",
          price_kind: "fixed",
          currency: "SEK",
          amount_minor: 180000,
          available_date: "2026-09-02",
          company_note: "Ring 0701234567",
          submitted_at: "2026-08-22T12:00:00.000Z",
          display_name: "Rör AB",
          public_slug: "ror-ab",
          provider_email: "offert@rorfirma.se",
          rating: null,
          review_count: 0,
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          status: "rejected",
          price_kind: "estimate",
          currency: "SEK",
          amount_minor: 190000,
          available_date: "2026-09-03",
          company_note: "Maila annan@firma.se",
          submitted_at: "2026-08-22T12:05:00.000Z",
          display_name: "Annan AB",
          public_slug: "annan-ab",
          provider_email: "",
          rating: null,
          review_count: 0,
        },
      ],
    );
    mocks.getSql.mockReturnValue(sql);

    const view = await getMarketplaceCustomerComparison("a".repeat(43));

    expect(view?.selectedOfferId).toBe("22222222-2222-4222-8222-222222222222");
    expect(view?.offers[0]?.providerEmail).toBe("offert@rorfirma.se");
    expect(view?.offers[0]?.companyNote).toContain("0701234567");
    expect(view?.offers[1]?.providerEmail).toBe("");
    expect(view?.offers[1]?.companyNote).not.toContain("annan@firma.se");
    expect(queryText(sql.mock.calls[1])).toContain("case when offer.status = 'selected' then invitation.recipient_email else '' end");
  });

  it("sends one secure comparison email after the first submitted offer", async () => {
    const quoteRequestId = "11111111-1111-4111-8111-111111111111";
    const sql = sqlResponses(
      [{
        quote_request_id: quoteRequestId,
        reference_id: "PRO-123",
        contact_name: "Anna",
        contact_email: "anna@example.se",
      }],
      [{ quote_request_id: quoteRequestId }],
      [{ quote_request_id: quoteRequestId }],
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.sendComparisonEmail.mockResolvedValue({ ok: true, providerMessageId: "brevo-1" });

    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "https://www.proffera.se/offert/svara/token",
    });

    expect(result).toEqual({ ok: true, code: "sent" });
    expect(mocks.sendComparisonEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendComparisonEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "anna@example.se",
      comparisonUrl: expect.stringMatching(/^https:\/\/www\.proffera\.se\/offert\/jamfor\/[A-Za-z0-9_-]{43}$/),
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }));
    expect(queryText(sql.mock.calls[1])).toContain("on conflict (quote_request_id) do nothing");
  });

  it("does not send a duplicate email while a valid customer link is already sent", async () => {
    const quoteRequestId = "11111111-1111-4111-8111-111111111111";
    const sql = sqlResponses(
      [{
        quote_request_id: quoteRequestId,
        reference_id: "PRO-123",
        contact_name: "Anna",
        contact_email: "anna@example.se",
      }],
      [],
      [],
      [{ status: "sent", expires_at: "2099-01-01T00:00:00.000Z" }],
    );
    mocks.getSql.mockReturnValue(sql);

    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "https://www.proffera.se",
    });

    expect(result).toEqual({ ok: true, code: "already_sent" });
    expect(mocks.sendComparisonEmail).not.toHaveBeenCalled();
  });

  it("selects one offer, rejects the rest, cancels open outreach and closes the request atomically", async () => {
    const selectedOfferId = "22222222-2222-4222-8222-222222222222";
    const sql = sqlResponses([{ id: selectedOfferId }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await selectMarketplaceCustomerOffer("a".repeat(43), selectedOfferId);

    expect(result).toEqual({ ok: true, offerId: selectedOfferId });
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("for update of access, request");
    expect(query).toContain("set status = 'selected'");
    expect(query).toContain("set status = 'rejected'");
    expect(query).toContain("set status = 'cancelled'");
    expect(query).toContain("set status = 'booked'");
    expect(query).toContain("existing.status = 'selected'");
  });
});
