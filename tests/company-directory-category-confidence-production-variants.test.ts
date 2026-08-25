import { describe, expect, it } from "vitest";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";

function assess(input: {
  categorySlug: string;
  primarySniCode: string;
  activityDescription: string;
  legalName?: string;
  displayName?: string;
  sniCodes?: Array<{ code: string; label: string }>;
}) {
  return assessCompanyDirectoryCategoryConfidence({
    categorySlug: input.categorySlug,
    primarySniCode: input.primarySniCode,
    legalName: input.legalName ?? "Exempel AB",
    displayName: input.displayName ?? input.legalName ?? "Exempel AB",
    activityDescription: input.activityDescription,
    registeredNames: [],
    sniCodes: input.sniCodes ?? [{ code: input.primarySniCode, label: "Official primary SNI" }],
  });
}

describe("company directory category confidence Production text variants", () => {
  it.each([
    "Bolaget ska bedriva städentreprenadverksamhet.",
    "Bolaget ska tillhandahålla städtjänster.",
    "Bolaget kommer bedriva städverksamhet.",
    "Bolaget ska bedriva städrörelse.",
  ])("recognizes Swedish cleaning compound %s", (activityDescription) => {
    const result = assess({
      categorySlug: "stadning",
      primarySniCode: "81.210",
      activityDescription,
    });

    expect(result.level).toBe("high");
    expect(result.signals).toContain("Verksamhetsbeskrivningen stödjer kategorin");
  });

  it("does not turn unaccented Swedish Stad into cleaning evidence", () => {
    const result = assess({
      categorySlug: "stadning",
      primarySniCode: "81.210",
      legalName: "Stockholm Stad Service AB",
      activityDescription: "",
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.signals).not.toContain("Företagsnamn stödjer kategorin");
  });

  it("does not treat Swedish städer as a cleaning compound", () => {
    const result = assess({
      categorySlug: "stadning",
      primarySniCode: "81.210",
      activityDescription: "Bolaget bedriver verksamhet i svenska städer.",
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Ingen oberoende textsignal stödjer kategorin");
  });

  it.each([
    "Filialen ska bedriva elentreprenad.",
    "Filialen ska bedriva elinstalaltioner på byggarbetsplatser.",
    "Bolaget projekterar och installerar svagströmsanläggningar.",
    "Bolaget installerar laddningsstationer för elfordon.",
    "Bolaget bedriver installationsrörelse inom el-branschen.",
  ])("recognizes narrow electrician corroboration %s", (activityDescription) => {
    const result = assess({
      categorySlug: "elektriker",
      primarySniCode: "43.210",
      activityDescription,
    });

    expect(result.level).toBe("high");
    expect(result.signals).toContain("Verksamhetsbeskrivningen stödjer kategorin");
  });

  it.each([
    "Aktiebolaget skall bedriva frisyr- och hudvårdsverksamhet.",
    "Föremålet för verksamheten är att bedriva hårsalong.",
    "Bolaget skall bedriva hår och hudvård.",
  ])("recognizes narrow hairdresser corroboration %s", (activityDescription) => {
    const result = assess({
      categorySlug: "frisor",
      primarySniCode: "96.210",
      activityDescription,
    });

    expect(result.level).toBe("high");
    expect(result.signals).toContain("Verksamhetsbeskrivningen stödjer kategorin");
  });

  it.each([
    "Bolaget skall bedriva trädvård och trädfällning.",
    "Bolaget erbjuder arboristtjänster och beskärning.",
    "Bolaget bygger och sköter bevattningsanläggningar.",
  ])("recognizes narrow garden corroboration %s", (activityDescription) => {
    const result = assess({
      categorySlug: "tradgard",
      primarySniCode: "81.300",
      activityDescription,
    });

    expect(result.level).toBe("high");
    expect(result.signals).toContain("Verksamhetsbeskrivningen stödjer kategorin");
  });

  it("recognizes luftbehandling as VVS corroboration", () => {
    const result = assess({
      categorySlug: "vvs",
      primarySniCode: "43.222",
      activityDescription: "Bolaget bedriver entreprenad inom luftbehandling.",
    });

    expect(result.level).toBe("high");
  });

  it("recognizes explicit kitchen installation as carpentry corroboration", () => {
    const result = assess({
      categorySlug: "snickeri",
      primarySniCode: "43.320",
      activityDescription: "Filialen bedriver montering av kök.",
    });

    expect(result.level).toBe("high");
  });

  it.each([
    {
      categorySlug: "elektriker",
      primarySniCode: "43.210",
      activityDescription: "Bolaget bedriver konsultverksamhet inom byggnadsindustrin och värdepappersförvaltning.",
    },
    {
      categorySlug: "frisor",
      primarySniCode: "96.210",
      activityDescription: "Bolaget bedriver arbete och handel med byggnadsställningar.",
    },
    {
      categorySlug: "tradgard",
      primarySniCode: "81.300",
      activityDescription: "Bolaget ska äga och förvalta fastigheter.",
    },
  ])("keeps exact SNI with unrelated Production text in Review: $categorySlug", (input) => {
    const result = assess(input);

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Ingen oberoende textsignal stödjer kategorin");
  });

  it("keeps newly recognized secondary cleaning text fail-closed for a painting profile", () => {
    const result = assess({
      categorySlug: "maleri",
      primarySniCode: "43.341",
      activityDescription: "Måleriarbeten, byggnationer och städtjänster.",
    });

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.conflictingTextCategories).toContain("stadning");
  });
});
