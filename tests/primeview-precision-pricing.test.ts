import { describe, expect, it } from "vitest";

import { calculatePrimeViewPrice } from "@/features/primeview/pricing";

describe("PrimeView precision pricing", () => {
  it("enforces the £40 minimum for a tiny window job", () => {
    const result = calculatePrimeViewPrice({
      serviceKey: "window",
      cleaningScope: "Outside only",
      standardWindows: 2,
      largeWindows: 0,
      bayWindows: 0,
      hardAccessWindows: 0,
      frequency: "One-off",
      access: "Normal",
      condition: "Normal",
      floors: "Ground floor only",
    });
    expect(result.kind).toBe("price");
    if (result.kind === "price") {
      expect(result.total).toBe(40);
      expect(result.minimumApplied).toBe(true);
    }
  });

  it("calculates standard outside window cleaning", () => {
    const result = calculatePrimeViewPrice({
      serviceKey: "window",
      cleaningScope: "Outside only",
      standardWindows: 15,
      largeWindows: 0,
      bayWindows: 0,
      hardAccessWindows: 0,
      frequency: "One-off",
      access: "Normal",
      condition: "Normal",
      floors: "Ground + 1st floor",
    });
    expect(result.kind).toBe("price");
    if (result.kind === "price") expect(result.total).toBe(60);
  });

  it("applies recurring, condition, floor and access rules before minimum", () => {
    const result = calculatePrimeViewPrice({
      serviceKey: "window",
      cleaningScope: "Outside only",
      standardWindows: 20,
      largeWindows: 0,
      bayWindows: 0,
      hardAccessWindows: 2,
      frequency: "Every 4 weeks",
      access: "Moderately difficult",
      condition: "Very dirty",
      floors: "3rd floor or higher",
    });
    expect(result.kind).toBe("price");
    if (result.kind === "price") {
      expect(result.total).toBeGreaterThan(100);
      expect(result.lines.some((line) => line.label.includes("Every 4 weeks"))).toBe(true);
      expect(result.lines.some((line) => line.label.includes("3rd floor"))).toBe(true);
    }
  });

  it("prices gutter cleaning by property size and blockage", () => {
    const result = calculatePrimeViewPrice({
      serviceKey: "gutter",
      propertySize: "Semi-detached house",
      heavyBlockage: true,
      access: "Normal",
      condition: "Normal",
      floors: "Ground + 1st floor",
    });
    expect(result.kind).toBe("price");
    if (result.kind === "price") expect(result.total).toBe(120);
  });

  it("prices solar panels with the correct tier and minimum", () => {
    const small = calculatePrimeViewPrice({ serviceKey: "solar", solarPanels: 4, access: "Normal", condition: "Normal" });
    const medium = calculatePrimeViewPrice({ serviceKey: "solar", solarPanels: 12, access: "Normal", condition: "Normal" });
    const large = calculatePrimeViewPrice({ serviceKey: "solar", solarPanels: 20, access: "Normal", condition: "Normal" });
    expect(small.kind === "price" && small.total).toBe(60);
    expect(medium.kind === "price" && medium.total).toBe(72);
    expect(large.kind === "price" && large.total).toBe(100);
  });

  it("enforces the £180 pressure-washing minimum", () => {
    const result = calculatePrimeViewPrice({
      serviceKey: "patio",
      areaM2: 10,
      heavyDirtMoss: false,
      access: "Normal",
    });
    expect(result.kind).toBe("price");
    if (result.kind === "price") expect(result.total).toBe(180);
  });

  it("requires manual quote for special equipment, extreme condition, sealing and 30+ solar panels", () => {
    expect(calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 10, access: "Very difficult" }).kind).toBe("manual");
    expect(calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Terraced house", condition: "Extreme" }).kind).toBe("manual");
    expect(calculatePrimeViewPrice({ serviceKey: "patio", areaM2: 40, sealing: true }).kind).toBe("manual");
    expect(calculatePrimeViewPrice({ serviceKey: "solar", solarPanels: 31 }).kind).toBe("manual");
  });

  it("applies multi-service discount without bypassing the service minimum", () => {
    const result = calculatePrimeViewPrice({
      serviceKey: "window",
      cleaningScope: "Outside only",
      standardWindows: 10,
      frequency: "One-off",
      access: "Normal",
      condition: "Normal",
      floors: "Ground floor only",
      multiServiceCount: 2,
    });
    expect(result.kind).toBe("price");
    if (result.kind === "price") {
      expect(result.total).toBe(40);
      expect(result.minimumApplied).toBe(true);
    }
  });
});
