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
  it("gives unambiguous official SNI-only evidence high confidence", () => {
    const result = assess();

    expect(result.score).toBe(95);
    expect(result.level).toBe("high");
    expect(result.competingCategories).toEqual([]);
    expect(result.conflictingTextCategories).toEqual([]);
    expect(result.warnings).toContain("Ingen oberoende textsignal stödjer kategorin");
  });

  it("uses exact official SNI confirmation without inventing a separate primary-verification signal", () => {
    const result = assess({
      primarySniCode: "81.210",
      sniCodes: [{ code: "81.210", label: "Lokalvård" }],
    });

    expect(result.score).toBe(95);
    expect(result.level).toBe("high");
    expect(result.signals).toContain("Bolagsverkets/SCB:s SNI-lista bekräftar exakt primär SNI");
    expect(result.signals.some((signal) => signal.includes("Verifierad primär SNI"))).toBe(false);
  });

  it("keeps same-category but non-exact official SNI below high confidence", () => {
    const result = assess({
      categorySlug: "vvs",
      primarySniCode: "43.221",
      legalName: "VVS Rör & Värme AB",
      displayName: "VVS Rör & Värme AB",
      activityDescription: "VVS, rörinstallation och värmeservice.",
      sniCodes: [{ code: "43.229", label: "Annan VVS-installation" }],
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Officiell SNI-lista stödjer kategorin men bekräftar inte exakt primär SNI");
  });

  it("keeps high confidence with an independent activity-text signal", () => {
    const result = assess({
      activityDescription: "Städning, lokalvård och fönsterputs",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
  });

  it("keeps high confidence with an independent name signal", () => {
    const result = assess({
      legalName: "Trygg Städservice AB",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
  });

  it("recognizes exact Swedish Städ as cleaning-name evidence", () => {
    const result = assess({
      legalName: "Evelinas Städ AB",
      activityDescription: "Bolaget skall bedriva lokalvård hos privatpersoner och företag",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.signals).toContain("Företagsnamn stödjer kategorin");
  });

  it("recognizes canonically decomposed Swedish Städ as the same name evidence", () => {
    const result = assess({
      legalName: "Evelinas Sta\u0308d AB",
      activityDescription: "Bolaget skall bedriva lokalvård hos privatpersoner och företag",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.signals).toContain("Företagsnamn stödjer kategorin");
  });

  it("does not treat Swedish Stad as Städ cleaning evidence", () => {
    const result = assess({
      legalName: "Stockholm Stad Service AB",
    });

    expect(result.score).toBe(95);
    expect(result.level).toBe("high");
    expect(result.signals).not.toContain("Företagsnamn stödjer kategorin");
  });

  it("reaches high confidence when multiple independent same-category signals agree", () => {
    const result = assess({
      activityDescription: "Städning, lokalvård och fönsterputs",
      legalName: "Trygg Städservice AB",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.competingCategories).toEqual([]);
    expect(result.conflictingTextCategories).toEqual([]);
  });

  it("does not misclassify flyttstädning as moving-service evidence", () => {
    const result = assess({
      activityDescription: "Flyttstädning, hemstädning och fönsterputs",
      legalName: "Trygg Städservice AB",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.conflictingTextCategories).not.toContain("flytt");
  });

  it("normalizes decomposed flyttstädning before moving-conflict detection", () => {
    const result = assess({
      activityDescription: "Flyttsta\u0308dning, hemsta\u0308dning och fönsterputs",
      legalName: "Trygg Städservice AB",
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.conflictingTextCategories).not.toContain("flytt");
  });

  it.each([
    "Flyttstäd och hemstädning",
    "Vi kan flyttstäda och utföra hemstädning",
    "Vi flyttstädar och utför hemstädning",
  ])("does not treat Swedish move-out-cleaning form %s as moving evidence", (activityDescription) => {
    const result = assess({
      activityDescription,
      legalName: "Trygg Städservice AB",
    });

    expect(result.level).toBe("high");
    expect(result.conflictingTextCategories).not.toContain("flytt");
  });

  it.each([
    "Flyttstad och hemstadning",
    "Vi kan flyttstada och utföra hemstadning",
    "Vi utför flyttstadning och hemstadning",
    "Flyttstadfirma med hemstadning",
    "Flyttstadservice och hemstadning",
  ])("keeps ambiguous ASCII move-out-cleaning form %s fail closed", (activityDescription) => {
    const result = assess({
      activityDescription,
      legalName: "Trygg Städservice AB",
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.conflictingTextCategories).toContain("flytt");
  });

  it("preserves Flyttstaden as genuine moving-name evidence", () => {
    const result = assess({
      categorySlug: "flytt",
      primarySniCode: "49.420",
      legalName: "Flyttstaden AB",
      displayName: "Flyttstaden AB",
      activityDescription: "",
      sniCodes: [{ code: "49.420", label: "Flyttjänster" }],
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.signals).toContain("Företagsnamn stödjer kategorin");
  });

  it.each(["Flytt Städ AB", "Flytt-Städ AB"])(
    "preserves separated moving evidence in company name %s",
    (legalName) => {
      const result = assess({
        categorySlug: "flytt",
        primarySniCode: "49.420",
        legalName,
        displayName: legalName,
        activityDescription: "",
        sniCodes: [{ code: "49.420", label: "Flyttjänster" }],
      });

      expect(result.score).toBe(90);
      expect(result.level).toBe("review");
      expect(result.signals).toContain("Företagsnamn stödjer kategorin");
    },
  );

  it("keeps separated flytt and städning as a moving conflict for a cleaning profile", () => {
    const result = assess({
      legalName: "Trygg Städservice AB",
      activityDescription: "Flytt Städning och transport samt hemstädning",
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.conflictingTextCategories).toContain("flytt");
  });

  it("still recognizes real moving-service terms", () => {
    const result = assess({
      categorySlug: "flytt",
      primarySniCode: "49.420",
      activityDescription: "Flyttfirma med flyttservice och flyttning av bohag",
      legalName: "Exempel AB",
      displayName: "Exempel AB",
      sniCodes: [{ code: "49.420", label: "Flyttjänster" }],
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.signals).toContain("Verksamhetsbeskrivningen stödjer kategorin");
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
      legalName: "Trygg Elservice AB",
      sniCodes: [{ code: "43.210", label: "Elinstallationer" }],
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.competingCategories).toEqual([]);
    expect(result.conflictingTextCategories).toContain("snickeri");
    expect(result.warnings.some((warning) => warning.includes("Officiell företagstext"))).toBe(true);
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
