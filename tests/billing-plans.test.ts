import { describe, expect, it } from "vitest";

import {
  checkoutPlanDefinitions,
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

  it("shows the matching live Stripe currency option for each B2B market", () => {
    expect(getCheckoutPlanPriceLabel("starter", "SEK", "sv")).toBe("Från 299 kr/mån");
    expect(getCheckoutPlanPriceLabel("starter", "EUR", "en")).toBe("From €28/month");
    expect(getCheckoutPlanPriceLabel("professional", "GBP", "en")).toBe("From £55/month");
  });
});
