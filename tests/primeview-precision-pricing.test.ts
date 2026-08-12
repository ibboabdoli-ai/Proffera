import { describe, expect, it } from "vitest";

import { calculatePrimeViewPrice, serviceKeyFromName } from "@/features/primeview/pricing";

describe("PrimeView simple customer pricing", () => {
  it("uses £3 per normal outside window with a £29.99 minimum", () => {
    const small = calculatePrimeViewPrice({ serviceKey: "window", standardWindows: 2 });
    const larger = calculatePrimeViewPrice({ serviceKey: "window", standardWindows: 20 });
    expect(small.kind === "price" && small.total).toBe(29.99);
    expect(larger.kind === "price" && larger.total).toBe(60);
  });

  it("does not add old window surcharges", () => {
    const result = calculatePrimeViewPrice({ serviceKey: "window", standardWindows: 10, access: "Difficult", condition: "Very dirty", floorCount: "3+", firstClean: true, hardAccessWindows: 10 });
    expect(result.kind === "price" && result.total).toBe(30);
  });

  it("uses the requested gutter starting prices without old surcharges", () => {
    const terraced = calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Terraced house", access: "Difficult", heavyBlockage: true });
    const semi = calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Semi-detached house", condition: "Very dirty" });
    const detached = calculatePrimeViewPrice({ serviceKey: "gutter", propertySize: "Detached house" });
    expect(terraced.kind === "price" && terraced.total).toBe(59.99);
    expect(semi.kind === "price" && semi.total).toBe(69.99);
    expect(detached.kind === "price" && detached.total).toBe(69.99);
  });

  it("prices Fascia & Gutter by property type", () => {
    const terraced = calculatePrimeViewPrice({ serviceKey: "fascia_gutter", propertySize: "Terraced house" });
    const semi = calculatePrimeViewPrice({ serviceKey: "fascia_gutter", propertySize: "Semi-detached house", access: "Difficult" });
    const detached = calculatePrimeViewPrice({ serviceKey: "fascia_gutter", propertySize: "Detached house", condition: "Very dirty" });
    expect(terraced.kind === "price" && terraced.total).toBe(89.99);
    expect(semi.kind === "price" && semi.total).toBe(139.99);
    expect(detached.kind === "price" && detached.total).toBe(139.99);
  });

  it("uses £89.99 as the conservatory starting price without add-on surcharges", () => {
    const result = calculatePrimeViewPrice({ serviceKey: "conservatory", conservatorySize: "Large", access: "Difficult", condition: "Very dirty" });
    expect(result.kind === "price" && result.total).toBe(89.99);
  });

  it("uses a £59.99 solar minimum and keeps quantity tiers", () => {
    const small = calculatePrimeViewPrice({ serviceKey: "solar", solarPanels: 4, access: "Difficult" });
    const twelve = calculatePrimeViewPrice({ serviceKey: "solar", solarPanels: 12, condition: "Very dirty" });
    expect(small.kind === "price" && small.total).toBe(59.99);
    expect(twelve.kind === "price" && twelve.total).toBe(72);
  });

  it("uses a £179.99 pressure-washing minimum and ignores old add-ons", () => {
    const small = calculatePrimeViewPrice({ serviceKey: "patio", areaM2: 10, heavyDirtMoss: true, oilTreatment: true, weedTreatment: true, resanding: true, access: "Difficult" });
    const larger = calculatePrimeViewPrice({ serviceKey: "patio", areaM2: 25 });
    expect(small.kind === "price" && small.total).toBe(179.99);
    expect(larger.kind === "price" && larger.total).toBe(225);
  });

  it("maps the new Fascia & Gutter service and legacy name correctly", () => {
    expect(serviceKeyFromName("Fascia & Gutter Cleaning")).toBe("fascia_gutter");
    expect(serviceKeyFromName("Fascia & Soffit Cleaning")).toBe("fascia_gutter");
    expect(serviceKeyFromName("Gutter Cleaning")).toBe("gutter");
    expect(serviceKeyFromName("Pressure Washing")).toBe("patio");
  });

  it("does not price the previous Gutter + Pressure package", () => {
    expect(calculatePrimeViewPrice({ serviceKey: "package", propertySize: "Terraced house", areaM2: 20 }).kind).toBe("manual");
  });
});
