import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  sendMarketplaceGuestInvitationEmail: vi.fn(),
}));

import { buildMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote";

describe("marketplace guest quote private location boundary", () => {
  it("never projects exact customer address or coordinates to a provider", () => {
    const view = buildMarketplaceGuestQuoteView({
      invitation_id: "11111111-1111-4111-8111-111111111111",
      status: "sent",
      display_name: "Test El AB",
      public_slug: "test-el-ab",
      reference_id: "PF-LOCATION",
      category: "Elektriker",
      service_type: "Felsökning el",
      city: "Södertälje",
      postal_code: "151 46",
      description: "Felsökning i bostaden.",
      contact_name: "Test Customer",
      contact_email: "customer@example.com",
      contact_phone: "0700000000",
      preferred_date: "2026-08-29",
      price_kind: null,
      customer_address_line1: "Storgatan 12",
      customer_latitude: 59.19554,
      customer_longitude: 17.62525,
      customer_location_source: "address",
    }, "2026-08-30T12:00:00.000Z", false);

    expect(view).not.toHaveProperty("customer_address_line1");
    expect(view).not.toHaveProperty("customer_latitude");
    expect(view).not.toHaveProperty("customer_longitude");
    expect(view).not.toHaveProperty("customer_location_source");
    expect(view).not.toHaveProperty("addressLine1");
    expect(view).not.toHaveProperty("latitude");
    expect(view).not.toHaveProperty("longitude");
    expect(JSON.stringify(view)).not.toContain("Storgatan 12");
    expect(JSON.stringify(view)).not.toContain("59.19554");
    expect(JSON.stringify(view)).not.toContain("17.62525");
  });
});
