import { describe, expect, it } from "vitest";

import {
  formatWorkspaceServicePrice,
  validateWorkspaceServicePrice,
} from "./workspace-service-pricing";

describe("workspace service pricing", () => {
  it.each([
    ["fixed", "299", "SEK", 29_900],
    ["from", "35.50", "GBP", 3_550],
    ["from", "64,25", "EUR", 6_425],
  ] as const)("normalizes %s pricing in %s", (priceType, amount, currency, amountMinor) => {
    expect(validateWorkspaceServicePrice({ priceType, amount, currency })).toEqual({
      ok: true,
      value: { priceType, amountMinor, currency },
    });
  });

  it("keeps quote pricing free from a misleading numeric amount", () => {
    expect(validateWorkspaceServicePrice({ priceType: "quote", amount: "", currency: "GBP" })).toEqual({
      ok: true,
      value: { priceType: "quote", amountMinor: null, currency: "GBP" },
    });
    expect(validateWorkspaceServicePrice({ priceType: "quote", amount: "10", currency: "GBP" })).toEqual({
      ok: false,
      error: "price_amount",
    });
  });

  it.each(["-1", "1.234", "1,234", "free", ""])("rejects invalid fixed/from amount %s", (amount) => {
    expect(validateWorkspaceServicePrice({ priceType: "fixed", amount, currency: "SEK" })).toEqual({
      ok: false,
      error: "price_amount",
    });
  });

  it("rejects unknown pricing modes", () => {
    expect(validateWorkspaceServicePrice({ priceType: "hourly", amount: "100", currency: "EUR" })).toEqual({
      ok: false,
      error: "price_type",
    });
  });

  it("formats workspace currency without conversion or guessing", () => {
    expect(formatWorkspaceServicePrice({ priceType: "fixed", amountMinor: 29_900, currency: "SEK" }, "sv")).toContain("299");
    expect(formatWorkspaceServicePrice({ priceType: "from", amountMinor: 3_550, currency: "GBP" }, "en")).toBe("From £35.50");
    expect(formatWorkspaceServicePrice({ priceType: "quote", amountMinor: null, currency: "EUR" }, "en")).toBe("Request a quote");
  });
});
