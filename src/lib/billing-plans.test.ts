import { describe, expect, it } from "vitest";

import {
  checkoutPlanDefinitions,
  getCheckoutPlanDescription,
  getCheckoutPlanPriceLabel,
} from "./billing-plans";

describe("checkout plan product copy", () => {
  it("keeps Starter aligned with the canonical starter feature set", () => {
    const description = checkoutPlanDefinitions.starter.description.toLowerCase();
    expect(description).toContain("kund-crm");
    expect(description).toContain("leadhantering");
    expect(description).toContain("bokningspåminnelser");
  });

  it("describes Professional as an expansion beyond Starter rather than the CRM tier", () => {
    const description = checkoutPlanDefinitions.professional.description.toLowerCase();
    expect(description).toContain("allt i starter");
    expect(description).toContain("offerter");
    expect(description).not.toContain("samt crm");
  });

  it("localizes checkout descriptions without changing the configured plan prices", () => {
    expect(getCheckoutPlanDescription("starter", "en")).toContain("Customer CRM");
    expect(getCheckoutPlanDescription("professional", "en")).toContain("Everything in Starter");
    expect(getCheckoutPlanPriceLabel("starter", "SEK", "sv")).toBe("199 kr/mån");
    expect(getCheckoutPlanPriceLabel("professional", "SEK", "en")).toBe("SEK 599/month");
  });
});
