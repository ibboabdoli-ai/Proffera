import { describe, expect, it } from "vitest";

import {
  calculateQuoteOfferTotals,
  canTransitionWorkspaceQuoteOffer,
  isWorkspaceQuoteOfferStatus,
  workspaceQuoteOfferStatuses,
} from "./workspace-quote-offer-policy";

describe("workspace quote offer policy", () => {
  it("recognizes supported statuses", () => {
    for (const status of workspaceQuoteOfferStatuses) {
      expect(isWorkspaceQuoteOfferStatus(status)).toBe(true);
    }
    expect(isWorkspaceQuoteOfferStatus("reviewing")).toBe(false);
  });

  it.each([
    ["draft", "sent"],
    ["draft", "void"],
    ["sent", "accepted"],
    ["sent", "rejected"],
    ["sent", "expired"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionWorkspaceQuoteOffer(from, to)).toBe(true);
  });

  it.each([
    ["draft", "accepted"],
    ["accepted", "sent"],
    ["rejected", "draft"],
    ["expired", "accepted"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(canTransitionWorkspaceQuoteOffer(from, to)).toBe(false);
  });

  it("calculates VAT using integer minor units", () => {
    expect(calculateQuoteOfferTotals(10_000, 2_500)).toEqual({
      subtotalMinor: 10_000,
      vatRateBasisPoints: 2_500,
      vatAmountMinor: 2_500,
      totalMinor: 12_500,
    });
  });

  it("rounds VAT to the nearest minor unit", () => {
    expect(calculateQuoteOfferTotals(999, 2_500).vatAmountMinor).toBe(250);
  });

  it("rejects unsafe or invalid values", () => {
    expect(() => calculateQuoteOfferTotals(-1, 2_500)).toThrow();
    expect(() => calculateQuoteOfferTotals(100, 10_001)).toThrow();
    expect(() => calculateQuoteOfferTotals(1.5, 2_500)).toThrow();
  });
});
