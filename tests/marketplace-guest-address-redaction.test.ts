import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  marketplaceGuestInvitationEmailConfigured: vi.fn(() => true),
  sendMarketplaceGuestInvitationEmail: vi.fn(),
}));

import {
  buildMarketplaceGuestQuoteView,
  getMarketplaceGuestOptOutView,
} from "@/lib/marketplace-guest-quote";

const baseInvitation = {
  invitation_id: "11111111-1111-4111-8111-111111111111",
  status: "sent",
  expires_at: "2099-01-01T00:00:00.000Z",
  recipient_suppressed: false,
  quote_status: "submitted",
  display_name: "Test El AB",
  public_slug: "test-el-ab",
  reference_id: "PF-ADDRESS-PRIVACY",
  category: "VVS",
  service_type: "Läckande rör",
  city: "Teststad",
  postal_code: "123 45",
  customer_address_line1: "Testgatan 12",
  description: "Behöver hjälp på Testgatan 12 med läckande rör.",
  contact_name: "Test Customer",
  contact_email: "customer@example.com",
  contact_phone: "0700000000",
  preferred_date: "2026-09-15",
  price_kind: null,
  currency: null,
  amount_minor: null,
  available_date: null,
  company_note: null,
  submitted_at: null,
};

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("Marketplace guest description address privacy", () => {
  it("redacts the known exact customer address while preserving useful job text", () => {
    const view = buildMarketplaceGuestQuoteView(
      baseInvitation,
      "2099-01-01T00:00:00.000Z",
      false,
    );

    expect(view.description).not.toContain("Testgatan 12");
    expect(view.description).toContain("Behöver hjälp");
    expect(view.description).toContain("läckande rör");
    expect(view.description).toContain("[…]");
    expect(JSON.stringify(view)).not.toContain("Testgatan 12");
  });

  it("removes the exact street address from address plus postal-code text without over-redacting allowed area context", () => {
    const view = buildMarketplaceGuestQuoteView({
      ...baseInvitation,
      description: "Jobbet är på Testgatan 12, 123 45 Teststad.",
    }, "2099-01-01T00:00:00.000Z", false);

    expect(view.description).not.toContain("Testgatan 12");
    expect(view.description).toContain("123 45 Teststad");
    expect(view.city).toBe("Teststad");
    expect(view.postalCode).toBe("123 45");
  });

  it("keeps ordinary descriptions unchanged when they do not repeat the private address", () => {
    const description = "Behöver hjälp med badrummet, tredje våningen i Teststad.";
    const view = buildMarketplaceGuestQuoteView({
      ...baseInvitation,
      description,
    }, "2099-01-01T00:00:00.000Z", false);

    expect(view.description).toBe(description);
  });

  it("supplies the structured address to the canonical redactor on the alternate opt-out projection", async () => {
    const sql = vi.fn(async () => [baseInvitation]);
    mocks.getSql.mockReturnValue(sql);

    const view = await getMarketplaceGuestOptOutView("a".repeat(40));

    expect(view?.description).not.toContain("Testgatan 12");
    expect(view?.description).toContain("läckande rör");
    expect(queryText(sql.mock.calls[0])).toContain("q.customer_address_line1");
  });
});
