import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("restaurant booking review proof", () => {
  it("does not fabricate a restaurant rating and localizes replacement benefits", () => {
    const layoutSource = readFileSync(resolve(process.cwd(), "src/app/boka/[slug]/layout.tsx"), "utf8");
    const benefitsSource = readFileSync(resolve(process.cwd(), "src/app/boka/[slug]/restaurant-booking-benefits.tsx"), "utf8");

    expect(layoutSource).not.toContain('<strong>4,9</strong>');
    expect(layoutSource).not.toContain("Verifierade gäster");
    expect(layoutSource).toContain("{reviews.length ? (");
    expect(layoutSource).toContain("Verifierade omdömen");
    expect(layoutSource).toContain("RestaurantBookingBenefits");
    expect(benefitsSource).toContain('searchParams.get("lang")');
    expect(benefitsSource).toContain("Tydlig överblick");
    expect(benefitsSource).toContain("Clear overview");
    expect(benefitsSource).toContain("Se tider och bokningsinformation på ett ställe");
    expect(benefitsSource).toContain("See times and booking information in one place");
  });
});
