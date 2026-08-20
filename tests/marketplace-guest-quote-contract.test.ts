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
  hashMarketplaceGuestToken,
  isMarketplaceBusinessRecipientEmail,
  normalizeMarketplaceRecipientEmail,
  redactMarketplaceGuestDescription,
  sendMarketplaceGuestQuoteInvitation,
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
});
