import { describe, expect, it } from "vitest";

import { normalizeWorkspaceServicePublicSlug, validateWorkspaceServiceDraft } from "./workspace-service-policy";

function draft(overrides: Partial<Parameters<typeof validateWorkspaceServiceDraft>[0]> = {}) {
  return {
    name: "Fönsterputs",
    description: "Professionell fönsterputs.",
    shortDescription: "Rena fönster utan krångel.",
    category: "Städning",
    priceLabel: "Från 499 kr",
    basePriceSek: "499",
    durationMinutes: "60",
    bufferBeforeMinutes: "0",
    bufferAfterMinutes: "15",
    minimumNoticeMinutes: "120",
    maximumAdvanceDays: "90",
    serviceArea: "Södertälje",
    isActive: true,
    sortOrder: "100",
    publicSlug: "",
    publicStatus: "draft",
    conversionMode: "book",
    seoTitle: "",
    seoDescription: "",
    ...overrides,
  };
}

describe("workspace service public policy", () => {
  it("normalizes Swedish service names into stable URL slugs", () => {
    expect(normalizeWorkspaceServicePublicSlug("", "Fönsterputs & Städning")).toBe("fonsterputs-stadning");
  });

  it("allows a quote-only published service without booking duration", () => {
    const result = validateWorkspaceServiceDraft(draft({ publicStatus: "published", conversionMode: "quote", durationMinutes: "" }));
    expect(result.ok).toBe(true);
  });

  it("requires duration when a published service can be booked", () => {
    const result = validateWorkspaceServiceDraft(draft({ publicStatus: "published", conversionMode: "book", durationMinutes: "" }));
    expect(result).toEqual({ ok: false, error: "duration" });
  });

  it("keeps operational activation separate from publication", () => {
    const result = validateWorkspaceServiceDraft(draft({ isActive: false, publicStatus: "hidden" }));
    expect(result.ok && result.value.publicStatus).toBe("hidden");
    expect(result.ok && result.value.isActive).toBe(false);
  });
});
