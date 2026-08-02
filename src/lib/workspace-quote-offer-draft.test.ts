import { describe, expect, it } from "vitest";

import { validateWorkspaceQuoteOfferDraft } from "./workspace-quote-offer-draft";

describe("workspace quote offer draft", () => {
  it("normalizes amount, VAT and validity", () => {
    expect(validateWorkspaceQuoteOfferDraft({
      amount: "1000,50",
      vatRate: "25",
      title: "Window cleaning",
      terms: "Payment within 10 days.",
      validUntil: "2026-08-31",
      currency: "SEK",
    })).toEqual({
      ok: true,
      value: {
        currency: "SEK",
        subtotalMinor: 100_050,
        vatRateBasisPoints: 2_500,
        vatAmountMinor: 25_013,
        totalMinor: 125_063,
        title: "Window cleaning",
        terms: "Payment within 10 days.",
        validUntil: "2026-08-31",
      },
    });
  });

  it.each([
    [{ amount: "free" }, "amount"],
    [{ vatRate: "100.01" }, "vat_rate"],
    [{ title: "" }, "title"],
    [{ validUntil: "2026-02-30" }, "valid_until"],
  ] as const)("rejects invalid %s", (override, error) => {
    expect(validateWorkspaceQuoteOfferDraft({
      amount: "100",
      vatRate: "25",
      title: "Offer",
      terms: "",
      validUntil: "",
      currency: "EUR",
      ...override,
    })).toEqual({ ok: false, error });
  });
});
