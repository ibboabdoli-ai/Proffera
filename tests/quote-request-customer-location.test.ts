import { describe, expect, it } from "vitest";

import { createQuoteRequestSchema, initialQuoteRequest } from "../src/features/quote-request/schema";

const validRequest = {
  ...initialQuoteRequest,
  category: "Elektriker",
  serviceType: "Felsökning el",
  city: "Södertälje",
  postalCode: "151 46",
  description: "Jag behöver hjälp med felsökning av el i bostaden.",
  preferredDate: "Inom en vecka",
  contactName: "Test Customer",
  contactEmail: "customer@example.com",
  contactPhone: "0700000000",
  consentAccepted: true,
};

describe("quote request customer location", () => {
  it("accepts a private exact address", () => {
    const parsed = createQuoteRequestSchema("sv").safeParse({
      ...validRequest,
      addressLine1: "Storgatan 12",
      locationSource: "address",
      latitude: null,
      longitude: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts explicit browser geolocation without requiring a street address", () => {
    const parsed = createQuoteRequestSchema("en").safeParse({
      ...validRequest,
      addressLine1: "",
      locationSource: "geolocation",
      latitude: 59.19554,
      longitude: 17.62525,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a request that has neither a usable address nor a usable position", () => {
    const addressResult = createQuoteRequestSchema("sv").safeParse({
      ...validRequest,
      addressLine1: "",
      locationSource: "address",
      latitude: null,
      longitude: null,
    });
    const geolocationResult = createQuoteRequestSchema("sv").safeParse({
      ...validRequest,
      addressLine1: "",
      locationSource: "geolocation",
      latitude: 120,
      longitude: 17.62525,
    });

    expect(addressResult.success).toBe(false);
    expect(geolocationResult.success).toBe(false);
    if (!addressResult.success) expect(addressResult.error.issues[0]?.path).toEqual(["addressLine1"]);
    if (!geolocationResult.success) expect(geolocationResult.error.issues[0]?.path).toEqual(["addressLine1"]);
  });

  it("rejects mixed address and geolocation payloads before persistence", () => {
    const addressWithCoordinates = createQuoteRequestSchema("sv").safeParse({
      ...validRequest,
      addressLine1: "Storgatan 12",
      locationSource: "address",
      latitude: 59.19554,
      longitude: 17.62525,
    });
    const geolocationWithAddress = createQuoteRequestSchema("en").safeParse({
      ...validRequest,
      addressLine1: "Storgatan 12",
      locationSource: "geolocation",
      latitude: 59.19554,
      longitude: 17.62525,
    });

    expect(addressWithCoordinates.success).toBe(false);
    expect(geolocationWithAddress.success).toBe(false);
  });

  it("rejects incomplete geolocation payloads before persistence", () => {
    const missingLatitude = createQuoteRequestSchema("sv").safeParse({
      ...validRequest,
      addressLine1: "",
      locationSource: "geolocation",
      latitude: null,
      longitude: 17.62525,
    });
    const missingLongitude = createQuoteRequestSchema("sv").safeParse({
      ...validRequest,
      addressLine1: "",
      locationSource: "geolocation",
      latitude: 59.19554,
      longitude: null,
    });

    expect(missingLatitude.success).toBe(false);
    expect(missingLongitude.success).toBe(false);
  });
});
