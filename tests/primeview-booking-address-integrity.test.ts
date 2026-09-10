import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { beginBookingEmailVerification, validatePrimeViewServiceAddress } from "../src/lib/public-booking-verification";

function details(propertyType: string) {
  return `Property type: ${propertyType}\nAddress: test\nPostcode: W4 3ES`;
}

describe("PrimeView canonical service address validation", () => {
  beforeEach(() => mocks.getSql.mockReset());

  it("accepts a complete house address", () => {
    expect(validatePrimeViewServiceAddress({
      address: "10, High Street",
      postcode: "W4 3ES",
      bookingDetails: details("Terraced"),
    })).toBe(true);
  });

  it("accepts a building name plus street", () => {
    expect(validatePrimeViewServiceAddress({
      address: "Cricket Pavilion, Staveley Road",
      postcode: "W4 3ES",
      bookingDetails: details("Detached"),
    })).toBe(true);
  });

  it("accepts normalized whitespace in complete address parts", () => {
    expect(validatePrimeViewServiceAddress({
      address: "  Cricket   Pavilion ,  Staveley   Road  ",
      postcode: "W4 3ES",
      bookingDetails: details("Detached"),
    })).toBe(true);
  });

  it("rejects missing house/building", () => {
    expect(validatePrimeViewServiceAddress({
      address: "High Street",
      postcode: "W4 3ES",
      bookingDetails: details("Terraced"),
    })).toBe(false);
  });

  it("rejects missing street", () => {
    expect(validatePrimeViewServiceAddress({
      address: "10",
      postcode: "W4 3ES",
      bookingDetails: details("Terraced"),
    })).toBe(false);
  });

  it("requires a flat/apartment/unit number for Flat / Apartment", () => {
    expect(validatePrimeViewServiceAddress({
      address: "10, High Street",
      postcode: "W4 3ES",
      bookingDetails: details("Flat / Apartment"),
    })).toBe(false);
  });

  it("accepts a complete flat address", () => {
    expect(validatePrimeViewServiceAddress({
      address: "Flat 2B, 10, High Street",
      postcode: "W4 3ES",
      bookingDetails: details("Flat / Apartment"),
    })).toBe(true);
  });

  it("rejects an invalid UK postcode", () => {
    expect(validatePrimeViewServiceAddress({
      address: "10, High Street",
      postcode: "12345",
      bookingDetails: details("Terraced"),
    })).toBe(false);
  });

  it("rejects an incomplete PrimeView address before opening the database", async () => {
    const result = await beginBookingEmailVerification({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      slug: "primeview",
      companyName: "PrimeView Window Care",
      customerName: "Andrew Clark",
      customerEmail: "andy.clark@example.co.uk",
      customerPhone: "07973311643",
      serviceId: "22222222-2222-4222-8222-222222222222",
      serviceName: "Window Cleaning",
      city: "London",
      address: "10, High Street",
      postcode: "W4 3ES",
      bookingDetails: details("Flat / Apartment"),
      startsAt: "2026-09-15T10:00:00.000Z",
      endsAt: "2026-09-15T11:00:00.000Z",
      timeZone: "Europe/London",
      language: "en",
      verificationSms: true,
    });

    expect(result).toEqual({ ok: false, error: "address" });
    expect(mocks.getSql).not.toHaveBeenCalled();
  });
});
