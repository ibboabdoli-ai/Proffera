import { describe, expect, it } from "vitest";

import { checkoutPlanDefinitions, isCheckoutPlanKey } from "../src/lib/billing-plans";

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
});
