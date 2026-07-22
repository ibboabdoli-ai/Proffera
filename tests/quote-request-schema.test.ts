import { describe, expect, it } from "vitest";

import { quoteRequestSchema } from "../src/features/quote-request/schema";

const validRequest = {
  category: "Hemstädning",
  serviceType: "Engångsstädning",
  city: "Malmö",
  postalCode: "211 20",
  description: "Jag behöver hjälp med en grundlig städning av bostaden.",
  preferredDate: "Inom 1 vecka",
  contactName: "Anna Andersson",
  contactEmail: "anna@example.com",
  contactPhone: "+46 70 123 45 67",
  consentAccepted: true,
};

describe("quote request schema", () => {
  it("accepts a valid request with a service type in its category", () => {
    expect(quoteRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects inherited object properties as categories", () => {
    const result = quoteRequestSchema.safeParse({ ...validRequest, category: "constructor" });

    expect(result.success).toBe(false);
  });

  it("rejects a service type that belongs to another category", () => {
    const result = quoteRequestSchema.safeParse({ ...validRequest, serviceType: "Gräsklippning" });

    expect(result.success).toBe(false);
  });
});
