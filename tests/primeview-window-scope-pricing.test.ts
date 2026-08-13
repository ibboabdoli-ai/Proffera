import { describe, expect, it } from "vitest";

import { calculatePrimeViewPrice } from "../src/features/primeview/pricing";

describe("PrimeView window scope calculator", () => {
  it("uses the selected scope rate", () => {
    const outside = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 10 });
    const inside = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside only", standardWindows: 10 });
    const both = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside & outside", standardWindows: 10 });
    expect(outside.kind === "price" ? outside.total : null).toBe(30);
    expect(inside.kind === "price" ? inside.total : null).toBe(50);
    expect(both.kind === "price" ? both.total : null).toBe(80);
  });

  it("keeps the existing minimum and legacy default", () => {
    const minimum = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside only", standardWindows: 2 });
    const legacy = calculatePrimeViewPrice({ serviceKey: "window", standardWindows: 10 });
    expect(minimum.kind === "price" ? minimum.total : null).toBe(29.99);
    expect(legacy.kind === "price" ? legacy.total : null).toBe(30);
  });
});
