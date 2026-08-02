import { describe, expect, it } from "vitest";

import {
  isPlausiblePublicQuoteTiming,
  publicWorkspaceQuoteSchema,
} from "./public-quote";

const validPayload = {
  serviceId: null,
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+46 70 000 00 00",
  city: "Stockholm",
  postalCode: "111 22",
  description: "I would like a quote for recurring window cleaning.",
  preferredDate: "2026-08-10",
  website: "",
  formStartedAt: 1_000,
};

describe("public workspace quote contract", () => {
  it("accepts a normalized valid request", () => {
    const result = publicWorkspaceQuoteSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects invalid contact and short descriptions", () => {
    const result = publicWorkspaceQuoteSchema.safeParse({
      ...validPayload,
      email: "invalid",
      description: "short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-UUID service identifiers", () => {
    const result = publicWorkspaceQuoteSchema.safeParse({
      ...validPayload,
      serviceId: "other-workspace-service",
    });

    expect(result.success).toBe(false);
  });

  it("accepts realistic completion timing only", () => {
    const now = 100_000;
    expect(isPlausiblePublicQuoteTiming(now - 2_500, now)).toBe(true);
    expect(isPlausiblePublicQuoteTiming(now - 2_499, now)).toBe(false);
    expect(isPlausiblePublicQuoteTiming(now - 24 * 60 * 60 * 1_000, now)).toBe(true);
    expect(isPlausiblePublicQuoteTiming(now - 24 * 60 * 60 * 1_000 - 1, now)).toBe(false);
  });
});
