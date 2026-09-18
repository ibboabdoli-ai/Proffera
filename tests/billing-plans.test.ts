import { describe, expect, it } from "vitest";

import {
  checkoutPlanDefinitions,
  checkoutPlanMonthlyPricesSek,
  getCheckoutPlanPriceLabel,
  isCheckoutPlanKey,
} from "../src/lib/billing-plans";

describe("checkout plans", () => {
  it("only accepts plans that have a defined checkout entitlement", () => {
    expect(isCheckoutPlanKey("starter")).toBe(true);
    expect(isCheckoutPlanKey("professional")).toBe(true);
    expect(isCheckoutPlanKey("business")).toBe(false);
    expect(isCheckoutPlanKey("__proto__")).toBe(false);
  });

  it("keeps the paid plan definitions explicit", () => {
    expect(checkoutPlanDefinitions.starter.name).toBe("Starter");
    expect(checkoutPlanDefinitions.professional.name).toBe("Professional");
  });

  it("uses the canonical launch prices without inventing local-currency amounts", () => {
    expect(checkoutPlanMonthlyPricesSek).toEqual({ starter: 299, professional: 599 });
    expect(getCheckoutPlanPriceLabel("starter", "SEK", "sv")).toBe("299 kr/mån");
    expect(getCheckoutPlanPriceLabel("starter", "EUR", "en")).toBe(
      "SEK 299/month · final currency shown at checkout",
    );
    expect(getCheckoutPlanPriceLabel("professional", "GBP", "en")).toBe(
      "SEK 599/month · final currency shown at checkout",
    );
  });
});
