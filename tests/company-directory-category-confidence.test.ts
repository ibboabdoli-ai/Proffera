import { describe, expect, it } from "vitest";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";

function assess(overrides: Partial<Parameters<typeof assessCompanyDirectoryCategoryConfidence>[0]> = {}) {
  return assessCompanyDirectoryCategoryConfidence({
    categorySlug: "stadning",
    primarySniCode: "81.210",
    legalName: "Exempel AB",
    displayName: "Exempel AB",
    activityDescription: "",
    registeredNames: [],
    sniCodes: [{ code: "81.210", label: "Lokalvård" }],
    ...overrides,
  });
}

describe("company directory category confidence", () => {
  it("reaches high confidence only from exact, unambiguous official SNI consensus", () => {
    const result = assess();

    expect(result.score).toBe(95);
    expect(result.level).toBe("high");
    expect(result.competingCategories).toEqual([]);
    expect(result.conflictingTextCategories).toEqual([]);
    expect(result.signals).toContain(
      "Verifierad primär SNI och fullständig officiell SNI-lista pekar entydigt på kategorin",
    );
  });

  it("does not grant the consensus signal when the exact primary SNI is missing from Official Facts", () => {
    const result = assess({
      primarySniCode: "81.210",
      sniCodes: [{ code: "81.221", label: "Städning" }],
    });

    expect(result.score).toBe(80);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Primär SNI saknar exakt bekräftelse i Official Facts");
  });

  it("keeps profiles with competing supported official SNI categories below 95", () => {
    const result = assess({
      categorySlug: "elektriker",
      primarySniCode: "43.210",
      activityDescription: "Elinstallation och elservice",
      sniCodes: [
        { code: "43.210", label: "Elinstallationer" },
        { code: "43.320", label: "Byggnadssnickeriarbeten" },
      ],
    });

    expect(result.score).toBeLessThanOrEqual(90);
    expect(result.level).not.toBe("high");
    expect(result.competingCategories).toContain("snickeri");
  });

  it("caps confidence at 90 when official company text points to another supported category", () => {
    const result = assess({
      categorySlug: "elektriker",
      primarySniCode: "43.210",
      activityDescription: "Elinstallation, elservice och snickeriarbeten",
      sniCodes: [{ code: "43.210", label: "Elinstallationer" }],
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.competingCategories).toEqual([]);
    expect(result.conflictingTextCategories).toContain("snickeri");
    expect(result.warnings.some((warning) => warning.includes("Officiell företagstext"))).toBe(true);
  });

  it("allows supporting text for the same category without creating a false conflict", () => {
    const result = assess({
      activityDescription: "Städning, lokalvård och fönsterputs",
      legalName: "Trygg Städservice AB",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.conflictingTextCategories).toEqual([]);
  });

  it("keeps missing Official Facts fail-closed even with supporting text", () => {
    const result = assess({
      legalName: "Trygg Städservice AB",
      activityDescription: "Städning och lokalvård",
      sniCodes: [],
    });

    expect(result.officialFactsReady).toBe(false);
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result.level).not.toBe("high");
  });

  it("does not rescue a primary SNI/category mismatch", () => {
    const result = assess({
      categorySlug: "vvs",
      primarySniCode: "43.210",
      activityDescription: "VVS och rörinstallation",
      sniCodes: [{ code: "43.210", label: "Elinstallationer" }],
    });

    expect(result.level).toBe("low");
    expect(result.warnings).toContain("Primär SNI matchar inte profilens kategori");
  });
});