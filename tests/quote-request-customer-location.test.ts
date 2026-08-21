import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  it("persists location privately without adding it to the provider-facing Guest Quote projection", () => {
    const persistence = readFileSync(join(process.cwd(), "src/features/quote-request/persistence.ts"), "utf8");
    const providerGuestFlow = readFileSync(join(process.cwd(), "src/lib/marketplace-guest-quote.ts"), "utf8");
    const migration = readFileSync(join(process.cwd(), "db/migrations/20260821_0056_quote_request_customer_location.sql"), "utf8");

    for (const field of ["customer_address_line1", "customer_latitude", "customer_longitude", "customer_location_source"]) {
      expect(persistence).toContain(field);
      expect(migration).toContain(field);
      expect(providerGuestFlow).not.toContain(field);
    }
  });

  it("requires database rows to contain one complete location shape and rejects NULL-valued mixed shapes", () => {
    const migration = readFileSync(join(process.cwd(), "db/migrations/20260821_0056_quote_request_customer_location.sql"), "utf8");

    expect(migration).toContain("quote_requests_customer_location_consistency_check");
    expect(migration).toContain("check (coalesce((");
    expect(migration).toContain("), false));");
    expect(migration).toContain("customer_location_source is null");
    expect(migration).toContain("customer_location_source = 'address'");
    expect(migration).toContain("customer_location_source = 'geolocation'");
    expect(migration).toContain("customer_latitude is not null");
    expect(migration).toContain("customer_longitude is not null");
    expect(migration).toContain("customer_latitude between -90 and 90");
    expect(migration).toContain("customer_longitude between -180 and 180");
  });

  it("preserves the in-progress form across Swedish and English language switches with tab-scoped storage", () => {
    const form = readFileSync(join(process.cwd(), "src/features/quote-request/localized-quote-request-form.tsx"), "utf8");
    const swedishPage = readFileSync(join(process.cwd(), "src/app/fa-offert/page.tsx"), "utf8");
    const englishPage = readFileSync(join(process.cwd(), "src/app/en/get-quote/page.tsx"), "utf8");

    expect(form).toContain("window.sessionStorage.setItem");
    expect(form).toContain("window.sessionStorage.removeItem");
    expect(form).toContain("DRAFT_MAX_AGE_MS");
    expect(form).toContain("requestAnimationFrame");
    expect(swedishPage).toContain("/en/get-quote?resume=1");
    expect(englishPage).toContain("/fa-offert?resume=1");
  });

  it("invalidates pending geolocation callbacks when the address is edited", () => {
    const locationStep = readFileSync(join(process.cwd(), "src/features/quote-request/step-location.tsx"), "utf8");

    expect(locationStep).toContain("useRef");
    expect(locationStep).toContain("nearbyRequestId.current");
    expect(locationStep).toContain("requestId !== nearbyRequestId.current");
  });
});
