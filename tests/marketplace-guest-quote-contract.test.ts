import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  sendInvitationEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  sendMarketplaceGuestInvitationEmail: mocks.sendInvitationEmail,
}));

import {
  buildMarketplaceGuestQuoteView,
  getMarketplaceGuestOptOutView,
  hashMarketplaceGuestToken,
  isMarketplaceBusinessRecipientEmail,
  normalizeMarketplaceRecipientEmail,
  redactMarketplaceGuestDescription,
  sendMarketplaceGuestQuoteInvitation,
  submitMarketplaceGuestQuote,
  suppressMarketplaceGuestRecipient,
} from "@/lib/marketplace-guest-quote";

const eligibleRow = {
  quote_request_id: "11111111-1111-4111-8111-111111111111",
  reference_id: "PF-1234",
  category: "VVS",
  service_type: "VVS / Rörmokare",
  city: "Södertälje",
  preferred_date: "2026-08-25",
  quote_status: "submitted",
  consent_accepted: true,
  profile_id: "22222222-2222-4222-8222-222222222222",
  public_slug: "ror-ab",
  display_name: "Rör AB",
  publication_status: "published",
  is_active: true,
  privacy_blocked: false,
  organization_kind: "juridical_person",
  claimed_workspace_id: null,
};

function invitationInput() {
  return {
    quoteRequestId: eligibleRow.quote_request_id,
    profileId: eligibleRow.profile_id,
    recipientEmail: "offert@rorfirma.se",
    adminUserId: "admin-user",
    baseUrl: "https://www.proffera.se",
    wave: 1,
    matchScore: 90,
    matchReasons: ["test"],
  };
}

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? []);
}

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("marketplace guest quote safety contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSql.mockReset();
    mocks.sendInvitationEmail.mockReset();
  });

  it("produces a SHA-256 token hash that fits the stored hash contract", () => {
    const hash = hashMarketplaceGuestToken("example-marketplace-guest-token-value-123456789");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes outreach addresses before suppression and invitation checks", () => {
    expect(normalizeMarketplaceRecipientEmail("  Kontakt@Foretag.SE ")).toBe("kontakt@foretag.se");
  });

  it("accepts business-domain email and rejects public mailbox or invalid email", () => {
    expect(isMarketplaceBusinessRecipientEmail("offert@rorfirma.se")).toBe(true);
    expect(isMarketplaceBusinessRecipientEmail("rorfirma@gmail.com")).toBe(false);
    expect(isMarketplaceBusinessRecipientEmail("not-an-email")).toBe(false);
  });

  it("redacts known customer contact data from free-text descriptions", () => {
    const description = "Jag heter Anna Andersson. Ring 070 123 45 67 eller mejla anna@example.se om jobbet.";
    const redacted = redactMarketplaceGuestDescription(description, {
      name: "Anna Andersson",
      email: "anna@example.se",
      phone: "+46 70 123 45 67",
    });

    expect(redacted).not.toContain("Anna Andersson");
    expect(redacted).not.toContain("anna@example.se");
    expect(redacted).not.toContain("070 123 45 67");
    expect(redacted).toContain("[…]");
  });

  it("redacts Unicode email addresses typed only in the description", () => {
    const description = "Skicka gärna kopian till kontakt@företag.se när ni svarar.";
    const redacted = redactMarketplaceGuestDescription(description, {
      name: "Anna Andersson",
      email: "anna@example.se",
      phone: "070 123 45 67",
    });

    expect(redacted).not.toContain("kontakt@företag.se");
    expect(redacted).toContain("[…]");
  });

  it("redacts alternate Swedish phone numbers typed only in the description", () => {
    const description = "Ring min partner på 073-555 11 22 om ni inte får tag på mig.";
    const redacted = redactMarketplaceGuestDescription(description, {
      name: "Anna Andersson",
      email: "anna@example.se",
      phone: "070 123 45 67",
    });

    expect(redacted).not.toContain("073-555 11 22");
    expect(redacted).toContain("[…]");
  });

  it("redacts an international phone number typed only in the description", () => {
    const description = "If needed, call our UK contact on +44 20 7946 0958.";
    const redacted = redactMarketplaceGuestDescription(description, {
      name: "Anna Andersson",
      email: "anna@example.se",
      phone: "070 123 45 67",
    });

    expect(redacted).not.toContain("+44 20 7946 0958");
    expect(redacted).toContain("[…]");
  });

  it("builds a guest view without customer contact fields", () => {
    const view = buildMarketplaceGuestQuoteView({
      invitation_id: "11111111-1111-4111-8111-111111111111",
      status: "sent",
      display_name: "Rör AB",
      public_slug: "ror-ab",
      reference_id: "PF-1234",
      category: "VVS",
      service_type: "VVS / Rörmokare",
      city: "Södertälje",
      postal_code: "151 00",
      description: "Kontakta Anna Andersson på anna@example.se eller 070-123 45 67.",
      contact_name: "Anna Andersson",
      contact_email: "anna@example.se",
      contact_phone: "0701234567",
      preferred_date: "2026-08-25",
      price_kind: null,
    }, "2026-08-26T12:00:00.000Z", false);

    expect(view).not.toHaveProperty("contactName");
    expect(view).not.toHaveProperty("contactEmail");
    expect(view).not.toHaveProperty("contactPhone");
    expect(view.description).not.toContain("Anna Andersson");
    expect(view.description).not.toContain("anna@example.se");
    expect(view.description).not.toContain("070-123 45 67");
  });

  it.each([
    ["unpublished", { publication_status: "review" }],
    ["inactive", { is_active: false }],
    ["privacy blocked", { privacy_blocked: true }],
    ["non-juridical", { organization_kind: "person" }],
    ["already claimed", { claimed_workspace_id: "33333333-3333-4333-8333-333333333333" }],
  ])("rejects an ineligible profile: %s", async (_label, overrides) => {
    const sql = sqlResponses([{ ...eligibleRow, ...overrides }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: false, code: "profile_ineligible" });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("does not invite a recipient that previously opted out", async () => {
    const sql = sqlResponses([eligibleRow], [{ id: "suppression-id" }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: false, code: "suppressed" });
    expect(sql).toHaveBeenCalledTimes(2);
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("keeps a fresh sending reservation protected from duplicate dispatch", async () => {
    const sql = sqlResponses(
      [eligibleRow],
      [],
      [{ id: "44444444-4444-4444-8444-444444444444", status: "sending", stale_reservation: false }],
    );
    mocks.getSql.mockReturnValue(sql);

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: false, code: "already_invited" });
    expect(sql).toHaveBeenCalledTimes(3);
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("reuses a stale sending reservation before provider dispatch", async () => {
    const invitationId = "44444444-4444-4444-8444-444444444444";
    const sql = sqlResponses(
      [eligibleRow],
      [],
      [{ id: invitationId, status: "sending", stale_reservation: true }],
      [{ id: invitationId }],
      [{ id: invitationId }],
      [{ id: invitationId }],
      [],
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.sendInvitationEmail.mockResolvedValue({ ok: true, providerMessageId: "provider-1" });

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: true, invitationId });
    expect(mocks.sendInvitationEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }));

    const reuseUpdate = queryText(sql.mock.calls[3]);
    expect(reuseUpdate).toContain("dispatch_token =");
    expect(reuseUpdate).toContain("status in ('sending', 'pending')");
    expect(reuseUpdate).toContain("updated_at <= now() - interval '5 minutes'");

    const dispatchClaim = queryText(sql.mock.calls[4]);
    expect(dispatchClaim).toContain("invitation.status = 'sending'");
    expect(dispatchClaim).toContain("invitation.dispatch_token =");
    expect(dispatchClaim).toContain("not exists");
    expect(dispatchClaim).toContain("marketplace_outreach_suppressions");

    const completion = queryText(sql.mock.calls[5]);
    expect(completion).toContain("invitation.status = 'pending'");
    expect(completion).toContain("invitation.dispatch_token =");
  });

  it("reuses a stale pending provider claim with a new dispatch owner", async () => {
    const invitationId = "44444444-4444-4444-8444-444444444444";
    const sql = sqlResponses(
      [eligibleRow],
      [],
      [{ id: invitationId, status: "pending", stale_reservation: true }],
      [{ id: invitationId }],
      [{ id: invitationId }],
      [{ id: invitationId }],
      [],
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.sendInvitationEmail.mockResolvedValue({ ok: true, providerMessageId: "provider-2" });

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: true, invitationId });
    expect(mocks.sendInvitationEmail).toHaveBeenCalledTimes(1);
    expect(queryText(sql.mock.calls[3])).toContain("dispatch_token =");
    expect(queryText(sql.mock.calls[3])).toContain("status in ('sending', 'pending')");
    expect(queryText(sql.mock.calls[5])).toContain("invitation.dispatch_token =");
  });

  it("renders opt-out as suppressed when the permanent suppression already exists", async () => {
    const sql = sqlResponses([{
      invitation_id: "44444444-4444-4444-8444-444444444444",
      status: "pending",
      expires_at: "2099-01-01T00:00:00.000Z",
      recipient_suppressed: true,
      display_name: "Rör AB",
      public_slug: "ror-ab",
      reference_id: "PF-1234",
      category: "VVS",
      service_type: "VVS / Rörmokare",
      city: "Södertälje",
      postal_code: "151 00",
      description: "Behöver hjälp med VVS.",
      contact_name: "Anna Andersson",
      contact_email: "anna@example.se",
      contact_phone: "0701234567",
      preferred_date: "2026-08-25",
      quote_status: "submitted",
      price_kind: null,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const view = await getMarketplaceGuestOptOutView("a".repeat(40));

    expect(view?.status).toBe("suppressed");
    expect(queryText(sql.mock.calls[0])).toContain("marketplace_outreach_suppressions");
  });

  it("does not invite against a closed customer request", async () => {
    const sql = sqlResponses([{ ...eligibleRow, quote_status: "cancelled" }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await sendMarketplaceGuestQuoteInvitation(invitationInput());

    expect(result).toEqual({ ok: false, code: "quote_closed" });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("rejects a guest offer when the underlying request is already closed", async () => {
    const sql = sqlResponses([{
      invitation_id: "44444444-4444-4444-8444-444444444444",
      quote_request_id: eligibleRow.quote_request_id,
      profile_id: eligibleRow.profile_id,
      workspace_id: null,
      status: "sent",
      expires_at: "2099-01-01T00:00:00.000Z",
      quote_status: "cancelled",
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await submitMarketplaceGuestQuote({
      token: "a".repeat(40),
      priceKind: "estimate",
      amountMinor: 100_00,
      availableDate: null,
      companyNote: "Test",
    });

    expect(result).toEqual({ ok: false, code: "closed" });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("does not report opt-out as fully settled while a fresh provider dispatch is already claimed", async () => {
    const sql = sqlResponses(
      [{
        id: "44444444-4444-4444-8444-444444444444",
        profile_id: eligibleRow.profile_id,
        recipient_email: "offert@rorfirma.se",
      }],
      [],
      [],
      [{ id: "55555555-5555-4555-8555-555555555555" }],
    ) as ReturnType<typeof sqlResponses> & { transaction?: ReturnType<typeof vi.fn> };
    sql.transaction = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);

    const result = await suppressMarketplaceGuestRecipient("a".repeat(40));

    expect(sql.transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, code: "dispatch_in_progress" });

    const suppressionInsert = queryText(sql.mock.calls[1]);
    expect(suppressionInsert).toContain("insert into marketplace_outreach_suppressions");

    const suppressionUpdate = queryText(sql.mock.calls[2]);
    expect(suppressionUpdate).toContain("status in ('sending', 'sent', 'viewed', 'delivery_failed', 'expired')");
    expect(suppressionUpdate).toContain("status = 'pending'");
    expect(suppressionUpdate).toContain("updated_at <= now() - interval '5 minutes'");

    const dispatchCheck = queryText(sql.mock.calls[3]);
    expect(dispatchCheck).toContain("status = 'pending'");
    expect(dispatchCheck).toContain("updated_at > now() - interval '5 minutes'");
  });
});
