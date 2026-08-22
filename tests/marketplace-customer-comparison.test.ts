import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_COMPARISON_SECRET = "test-marketplace-customer-comparison-secret";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  sendComparisonEmail: vi.fn(),
  hashGuestToken: vi.fn(),
  validGuestToken: vi.fn(),
  customerPortalSecret: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/auth-secret", () => ({ resolveCustomerPortalSecret: mocks.customerPortalSecret }));
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
  deriveMarketplaceCustomerComparisonToken,
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

function queryValues(call: unknown[] | undefined) {
  return call?.slice(1) ?? [];
}

describe("marketplace customer comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validGuestToken.mockReturnValue(true);
    mocks.hashGuestToken.mockReturnValue("guest-token-hash");
    mocks.customerPortalSecret.mockReturnValue(TEST_COMPARISON_SECRET);
  });

  it("derives a stable opaque customer token from the persisted dispatch id", () => {
    const quoteRequestId = "11111111-1111-4111-8111-111111111111";
    const dispatchToken = "44444444-4444-4444-8444-444444444444";
    const token = deriveMarketplaceCustomerComparisonToken({
      quoteRequestId,
      dispatchToken,
      secret: TEST_COMPARISON_SECRET,
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveMarketplaceCustomerComparisonToken({
      quoteRequestId,
      dispatchToken,
      secret: TEST_COMPARISON_SECRET,
    })).toBe(token);
    expect(deriveMarketplaceCustomerComparisonToken({
      quoteRequestId,
      dispatchToken: "55555555-5555-4555-8555-555555555555",
      secret: TEST_COMPARISON_SECRET,
    })).not.toBe(token);
    expect(hashMarketplaceCustomerComparisonToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(marketplaceCustomerComparisonPath(token)).toBe(`/offert/jamfor/${token}`);
  });

  it("rejects insecure comparison origins before any database or email work", async () => {
    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "http://example.test/offert/svara/token",
    });

    expect(result).toEqual({ ok: false, code: "invalid_base_url" });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.sendComparisonEmail).not.toHaveBeenCalled();
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

  it("persists the exact emailed token hash before the first comparison email", async () => {
    const quoteRequestId = "11111111-1111-4111-8111-111111111111";
    const dispatchToken = "44444444-4444-4444-8444-444444444444";
    const expectedToken = deriveMarketplaceCustomerComparisonToken({
      quoteRequestId,
      dispatchToken,
      secret: TEST_COMPARISON_SECRET,
    });
    const expectedHash = hashMarketplaceCustomerComparisonToken(expectedToken);
    const sql = sqlResponses(
      [{
        quote_request_id: quoteRequestId,
        reference_id: "PRO-123",
        contact_name: "Anna",
        contact_email: "anna@example.se",
      }],
      [{ quote_request_id: quoteRequestId, token_hash: expectedHash, dispatch_token: dispatchToken }],
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
    const comparisonUrl = String(mocks.sendComparisonEmail.mock.calls[0]?.[0]?.comparisonUrl ?? "");
    const emailedToken = comparisonUrl.split("/").at(-1) ?? "";
    expect(emailedToken).toBe(expectedToken);
    expect(hashMarketplaceCustomerComparisonToken(emailedToken)).toBe(expectedHash);
    expect(queryText(sql.mock.calls[1])).toContain("on conflict (quote_request_id) do nothing");
    expect(queryValues(sql.mock.calls[1])).toContain(expectedHash);
    expect(queryText(sql.mock.calls[2])).not.toContain("token_hash =");
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

  it("retries delivery failures with the same dispatch id and exactly the same comparison link", async () => {
    const quoteRequestId = "11111111-1111-4111-8111-111111111111";
    const stableDispatch = "55555555-5555-4555-8555-555555555555";
    const stableToken = deriveMarketplaceCustomerComparisonToken({
      quoteRequestId,
      dispatchToken: stableDispatch,
      secret: TEST_COMPARISON_SECRET,
    });
    const sql = sqlResponses(
      [{
        quote_request_id: quoteRequestId,
        reference_id: "PRO-123",
        contact_name: "Anna",
        contact_email: "anna@example.se",
      }],
      [],
      [{
        quote_request_id: quoteRequestId,
        dispatch_token: stableDispatch,
        token_hash: hashMarketplaceCustomerComparisonToken(stableToken),
      }],
      [{ quote_request_id: quoteRequestId }],
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.sendComparisonEmail.mockResolvedValue({ ok: true, providerMessageId: "brevo-retry" });

    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "https://www.proffera.se",
    });

    expect(result).toEqual({ ok: true, code: "sent" });
    expect(mocks.sendComparisonEmail).toHaveBeenCalledWith(expect.objectContaining({
      comparisonUrl: `https://www.proffera.se/offert/jamfor/${stableToken}`,
      idempotencyKey: stableDispatch,
    }));
    expect(queryText(sql.mock.calls[2])).not.toContain("set token_hash =");
    expect(queryText(sql.mock.calls[3])).not.toContain("token_hash =");
  });

  it("keeps the deterministic link valid when Brevo reports the stable dispatch id as a duplicate", async () => {
    const quoteRequestId = "11111111-1111-4111-8111-111111111111";
    const stableDispatch = "66666666-6666-4666-8666-666666666666";
    const stableToken = deriveMarketplaceCustomerComparisonToken({
      quoteRequestId,
      dispatchToken: stableDispatch,
      secret: TEST_COMPARISON_SECRET,
    });
    const sql = sqlResponses(
      [{
        quote_request_id: quoteRequestId,
        reference_id: "PRO-123",
        contact_name: "Anna",
        contact_email: "anna@example.se",
      }],
      [],
      [{
        quote_request_id: quoteRequestId,
        dispatch_token: stableDispatch,
        token_hash: hashMarketplaceCustomerComparisonToken(stableToken),
      }],
      [{ quote_request_id: quoteRequestId }],
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.sendComparisonEmail.mockResolvedValue({ ok: false, code: "duplicate", providerMessageId: null });

    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "https://www.proffera.se",
    });

    expect(result).toEqual({ ok: true, code: "already_sent" });
    expect(mocks.sendComparisonEmail).toHaveBeenCalledWith(expect.objectContaining({
      comparisonUrl: `https://www.proffera.se/offert/jamfor/${stableToken}`,
      idempotencyKey: stableDispatch,
    }));
    expect(queryText(sql.mock.calls[3])).not.toContain("token_hash =");
  });

  it("activates a replacement token before sending an expired-link email", async () => {
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
      [{ quote_request_id: quoteRequestId }],
      [],
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.sendComparisonEmail.mockResolvedValue({ ok: false, code: "network", providerMessageId: null });

    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "https://www.proffera.se",
    });

    expect(result).toEqual({ ok: false, code: "email_network" });
    const comparisonUrl = String(mocks.sendComparisonEmail.mock.calls[0]?.[0]?.comparisonUrl ?? "");
    const rawToken = comparisonUrl.split("/").at(-1) ?? "";
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(queryText(sql.mock.calls[3])).toContain("set token_hash =");
    expect(queryValues(sql.mock.calls[3])).toContain(hashMarketplaceCustomerComparisonToken(rawToken));
    expect(queryText(sql.mock.calls[4])).toContain("set status = 'delivery_failed'");
  });

  it("fails closed when the server comparison secret is unavailable", async () => {
    mocks.customerPortalSecret.mockReturnValueOnce(null);
    mocks.getSql.mockReturnValue(sqlResponses());

    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "https://www.proffera.se",
    });

    expect(result).toEqual({ ok: false, code: "configuration" });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.sendComparisonEmail).not.toHaveBeenCalled();
  });

  it("selects one offer successfully", async () => {
    const selectedOfferId = "22222222-2222-4222-8222-222222222222";
    const sql = sqlResponses([{ id: selectedOfferId }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await selectMarketplaceCustomerOffer("a".repeat(43), selectedOfferId);

    expect(result).toEqual({ ok: true, offerId: selectedOfferId });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("returns the competing winner after a 23505 selection race", async () => {
    const selectedOfferId = "22222222-2222-4222-8222-222222222222";
    const competingOfferId = "33333333-3333-4333-8333-333333333333";
    const conflict = Object.assign(new Error("unique conflict"), { code: "23505" });
    const sql = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce([{ id: competingOfferId }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await selectMarketplaceCustomerOffer("a".repeat(43), selectedOfferId);

    expect(result).toEqual({ ok: false, code: "already_selected" });
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("treats a customer re-click on the already selected offer as idempotent success", async () => {
    const selectedOfferId = "22222222-2222-4222-8222-222222222222";
    const sql = sqlResponses([], [{ id: selectedOfferId }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await selectMarketplaceCustomerOffer("a".repeat(43), selectedOfferId);

    expect(result).toEqual({ ok: true, offerId: selectedOfferId, alreadySelected: true });
  });

  it("returns closed when no offer can be selected and no winner exists", async () => {
    const selectedOfferId = "22222222-2222-4222-8222-222222222222";
    const sql = sqlResponses([], []);
    mocks.getSql.mockReturnValue(sql);

    const result = await selectMarketplaceCustomerOffer("a".repeat(43), selectedOfferId);

    expect(result).toEqual({ ok: false, code: "closed" });
  });
});
