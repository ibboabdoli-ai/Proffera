import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { validatePrimeViewServiceAddress } from "../src/lib/public-booking-verification";

function details(propertyType: string) {
  return `Property type: ${propertyType}\nAddress: test\nPostcode: W4 3ES`;
}

describe("PrimeView canonical service address validation", () => {
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
});
