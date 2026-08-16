import { describe, expect, it } from "vitest";

import {
  checkoutPlanDefinitions,
  getCheckoutPlanDescription,
  getCheckoutPlanPriceLabel,
} from "./billing-plans";

describe("checkout plan product copy", () => {
  it("keeps Starter aligned with the canonical starter feature set", () => {
    expect(checkoutPlanDefinitions.starter.description).toContain("Kund-CRM");
    expect(checkoutPlanDefinitions.starter.description).toContain("Leadhantering");
    expect(checkoutPlanDefinitions.starter.description).toContain("Bokningspåminnelser");
  });

  it("describes Professional as an expansion beyond Starter rather than the CRM tier", () => {
    expect(checkoutPlanDefinitions.professional.description).toContain("Allt i Starter");
    expect(checkoutPlanDefinitions.professional.description).toContain("Offerter");
    expect(checkoutPlanDefinitions.professional.description).not.toContain("samt CRM");
  });

  it("localizes checkout descriptions without changing the configured plan prices", () => {
    expect(getCheckoutPlanDescription("starter", "en")).toContain("Customer CRM");
    expect(getCheckoutPlanDescription("professional", "en")).toContain("Everything in Starter");
    expect(getCheckoutPlanPriceLabel("starter", "SEK", "sv")).toBe("199 kr/mån");
    expect(getCheckoutPlanPriceLabel("professional", "SEK", "en")).toBe("SEK 599/month");
  });
});
