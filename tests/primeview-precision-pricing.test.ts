import { describe, expect, it } from "vitest";

import { calculatePrimeViewPrice, serviceKeyFromName } from "@/features/primeview/pricing";

describe("PrimeView precision pricing", () => {
  it("enforces the £40 minimum for a tiny standard window job", () => {
    const result = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal" });
    expect(result.kind).toBe("price");
    if (result.kind === "price") expect(result.total).toBe(40);
  });

  it("uses property-specific window minimums", () => {
    const terraced = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", propertySize: "Terraced house" });
    const semi = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", propertySize: "Semi-detached house" });
    const detached = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", propertySize: "Detached house" });
    expect(terraced.kind === "price" && terraced.total).toBe(30);
    expect(semi.kind === "price" && semi.total).toBe(39);
    expect(detached.kind === "price" && detached.total).toBe(45);
  });

  it("keeps real window counts and rates in the calculation", () => {
    const result = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Inside & outside", standardWindows: 10, largeWindows: 2, bayWindows: 2, frequency: "One-off", access: "Normal", condition: "Normal", floorCount: "2", propertySize: "Semi-detached house" });
    expect(result.kind).toBe("price");
    if (result.kind === "price") {
      expect(result.lines.some((line) => line.label.includes("10 standard windows × £5.5"))).toBe(true);
      expect(result.lines.some((line) => line.label.includes("2 large windows × £7.5"))).toBe(true);
      expect(result.lines.some((line) => line.label.includes("2 very large / bay windows × £9"))).toBe(true);
    }
  });

  it("requires a quote for large or high detached window jobs", () => {
    const large = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 30, frequency: "One-off", access: "Normal", condition: "Normal", propertySize: "Detached house" });
    const high = calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 15, frequency: "One-off", access: "Normal", condition: "Normal", propertySize: "Detached house", workingHeight: "Second floor+" });
    expect(large.kind).toBe("manual");
    expect(high.kind).toBe("manual");
  });

  it("uses clean gutter base prices", () => {
    const terraced = calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Terraced house", access: "Normal", condition: "Normal" });
    const semi = calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Semi-detached house", access: "Normal", condition: "Normal" });
    const detached = calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Detached house", access: "Normal", condition: "Normal" });
    expect(terraced.kind === "price" && terraced.total).toBe(79);
    expect(semi.kind === "price" && semi.total).toBe(99);
    expect(detached.kind === "price" && detached.total).toBe(129);
  });

  it("requires a quote for large gutter jobs", () => {
    expect(calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Large property", access: "Normal", condition: "Normal" }).kind).toBe("manual");
  });

  it("keeps Pressure Washing independent with the £180 minimum", () => {
    const result = calculatePrimeViewPrice({ serviceKey: "patio", areaM2: 10, heavyDirtMoss: false, access: "Normal" });
    expect(result.kind).toBe("price");
    if (result.kind === "price") expect(result.total).toBe(180);
  });

  it("prices the Gutter + Pressure Washing package below the separate total", () => {
    const result = calculatePrimeViewPrice({ serviceKey: "package", propertySize: "Semi-detached house", areaM2: 10, access: "Normal", condition: "Normal" });
    expect(result.kind).toBe("price");
    if (result.kind === "price") {
      expect(result.compareAtTotal).toBe(279);
      expect(result.saving).toBe(30);
      expect(result.total).toBe(249);
      expect(result.total).toBeLessThan(result.compareAtTotal ?? Infinity);
      expect(result.lines.some((line) => line.label.includes("Save £30"))).toBe(true);
    }
  });

  it("does not treat a standalone gutter or pressure service as the package", () => {
    expect(serviceKeyFromName("Gutter Cleaning")).toBe("gutter");
    expect(serviceKeyFromName("Pressure Washing")).toBe("patio");
    expect(serviceKeyFromName("Gutter + Pressure Washing")).toBe("package");
  });

  it("requires manual review for difficult special cases", () => {
    expect(calculatePrimeViewPrice({ serviceKey: "window", cleaningScope: "Outside only", standardWindows: 10, access: "Very difficult" }).kind).toBe("manual");
    expect(calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Terraced house", condition: "Extreme" }).kind).toBe("manual");
    expect(calculatePrimeViewPrice({ serviceKey: "patio", areaM2: 40, sealing: true }).kind).toBe("manual");
    expect(calculatePrimeViewPrice({ serviceKey: "solar", solarPanels: 31 }).kind).toBe("manual");
  });
});
