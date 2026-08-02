import { describe, expect, it } from "vitest";

import {
  isWorkspaceServiceReadyForBooking,
  isWorkspaceServiceReadyForQuote,
  validateWorkspaceServiceDraft,
  type WorkspaceServiceDraft,
} from "./workspace-service-policy";

const validDraft: WorkspaceServiceDraft = {
  name: "Window cleaning",
  description: "Exterior window cleaning for homes and businesses.",
  category: "Cleaning",
  priceLabel: "From £35",
  basePriceSek: "",
  durationMinutes: "60",
  bufferBeforeMinutes: "0",
  bufferAfterMinutes: "15",
  minimumNoticeMinutes: "120",
  maximumAdvanceDays: "90",
  serviceArea: "West and North London",
  isActive: true,
  sortOrder: "10",
};

describe("workspace service policy", () => {
  it("normalizes a valid service without inventing a SEK price", () => {
    const result = validateWorkspaceServiceDraft(validDraft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.basePriceSek).toBeNull();
    expect(result.value.durationMinutes).toBe(60);
    expect(result.value.maximumAdvanceDays).toBe(90);
  });

  it.each([
    [{ name: "" }, "name"],
    [{ basePriceSek: "-1" }, "base_price"],
    [{ durationMinutes: "0" }, "duration"],
    [{ maximumAdvanceDays: "731" }, "duration"],
    [{ sortOrder: "" }, "sort"],
  ] as const)("rejects invalid service input with %s", (override, expectedError) => {
    const result = validateWorkspaceServiceDraft({ ...validDraft, ...override });
    expect(result).toEqual({ ok: false, error: expectedError });
  });

  it("separates booking readiness from quote readiness", () => {
    const quoteOnly = validateWorkspaceServiceDraft({ ...validDraft, durationMinutes: "" });
    expect(quoteOnly.ok).toBe(true);
    if (!quoteOnly.ok) return;
    expect(isWorkspaceServiceReadyForQuote(quoteOnly.value)).toBe(true);
    expect(isWorkspaceServiceReadyForBooking(quoteOnly.value)).toBe(false);
  });

  it("keeps inactive services unavailable for both customer flows", () => {
    const inactive = validateWorkspaceServiceDraft({ ...validDraft, isActive: false });
    expect(inactive.ok).toBe(true);
    if (!inactive.ok) return;
    expect(isWorkspaceServiceReadyForQuote(inactive.value)).toBe(false);
    expect(isWorkspaceServiceReadyForBooking(inactive.value)).toBe(false);
  });
});
