import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  sendMarketplaceGuestInvitationEmail: vi.fn(),
}));

import { buildMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote";

function expectPrivateLocationAbsent(view: ReturnType<typeof buildMarketplaceGuestQuoteView>, forbiddenValues: string[]) {
  expect(view).not.toHaveProperty("customer_address_line1");
  expect(view).not.toHaveProperty("customer_latitude");
  expect(view).not.toHaveProperty("customer_longitude");
  expect(view).not.toHaveProperty("customer_location_source");
  expect(view).not.toHaveProperty("addressLine1");
  expect(view).not.toHaveProperty("latitude");
  expect(view).not.toHaveProperty("longitude");
  expect(view).not.toHaveProperty("locationSource");
  const serialized = JSON.stringify(view);
  for (const value of forbiddenValues) expect(serialized).not.toContain(value);
}

const baseInvitation = {
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
};

describe("marketplace guest quote private location boundary", () => {
  it("never projects a valid private address location to a provider", () => {
    const view = buildMarketplaceGuestQuoteView({
      ...baseInvitation,
      customer_address_line1: "Storgatan 12",
      customer_latitude: null,
      customer_longitude: null,
      customer_location_source: "address",
    }, "2026-08-30T12:00:00.000Z", false);

    expectPrivateLocationAbsent(view, ["Storgatan 12"]);
  });

  it("never projects a valid private geolocation to a provider", () => {
    const view = buildMarketplaceGuestQuoteView({
      ...baseInvitation,
      customer_address_line1: null,
      customer_latitude: 59.19554,
      customer_longitude: 17.62525,
      customer_location_source: "geolocation",
    }, "2026-08-30T12:00:00.000Z", false);

    expectPrivateLocationAbsent(view, ["59.19554", "17.62525"]);
  });
});
