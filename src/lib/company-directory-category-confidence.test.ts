import { describe, expect, it } from "vitest";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";

function base(overrides: Partial<Parameters<typeof assessCompanyDirectoryCategoryConfidence>[0]> = {}) {
  return {
    categorySlug: "vvs",
    primarySniCode: "43.221",
    legalName: "Exempel AB",
    displayName: "Exempel AB",
    activityDescription: "",
    registeredNames: [],
    sniCodes: [{ code: "43221", label: "Värme- och sanitetsarbeten" }],
    ...overrides,
  };
}

describe("assessCompanyDirectoryCategoryConfidence", () => {
  it("gives high confidence when official SNI and sanitary business text corroborate VVS", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Carl Hanssons Rör & Värme Aktiebolag",
      displayName: "Carl Hanssons Rör & Värme Aktiebolag",
      activityDescription: "Bolaget utför fastighetssanitära installations- och underhållsarbeten.",
    }));

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.officialFactsReady).toBe(true);
  });

  it("gives high confidence when official hairdresser SNI and business text corroborate the category", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      categorySlug: "frisor",
      primarySniCode: "96.210",
      legalName: "Södertälje Frisör & Barber AB",
      displayName: "Södertälje Frisör & Barber AB",
      activityDescription: "Frisörverksamhet, hårvård och barberartjänster.",
      sniCodes: [{ code: "96210", label: "Frisörer och barberare" }],
    }));

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.officialFactsReady).toBe(true);
  });

  it("keeps unambiguous official SNI-only evidence in manual review", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Consulting & Management Holding CM AB",
      displayName: "Consulting & Management Holding CM AB",
      activityDescription: "Konsultverksamhet och företagsledning.",
    }));

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Ingen oberoende textsignal stödjer kategorin");
  });

  it("keeps Alight Ophelia out of electrician auto-publication when its business text only describes energy production", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      categorySlug: "elektriker",
      primarySniCode: "43.210",
      legalName: "Alight Ophelia AB",
      displayName: "Alight Ophelia AB",
      activityDescription: "Bolaget ska äga och förvalta system för energiproduktion, samt sälja energi och därtill anknutna tjänster.",
      sniCodes: [{ code: "43.210", label: "Elinstallationer" }],
    }));

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Ingen oberoende textsignal stödjer kategorin");
  });

  it("keeps competing supported categories in manual review", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Rör & Elservice AB",
      displayName: "Rör & Elservice AB",
      activityDescription: "VVS, rörinstallation och värmeservice.",
      sniCodes: [
        { code: "43221", label: "Värme- och sanitetsarbeten" },
        { code: "43210", label: "Elinstallationer" },
      ],
    }));

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.competingCategories).toEqual(["elektriker"]);
  });

  it("never gives high confidence when a competing official category is present", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "VVS Rörinstallation & El AB",
      displayName: "VVS Rörinstallation & El AB",
      activityDescription: "VVS, rörinstallation och värmeservice.",
      sniCodes: [
        { code: "43221", label: "Värme- och sanitetsarbeten" },
        { code: "43210", label: "Elinstallationer" },
      ],
    }));

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.competingCategories).toEqual(["elektriker"]);
  });

  it("caps confidence when the profile company name no longer matches Official Facts", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Gamla VVS Namnet AB",
      displayName: "Gamla VVS Namnet AB",
      activityDescription: "VVS, rörinstallation och värmeservice.",
      registeredNames: [{
        name: "Nya Rör & Värme AB",
        specialBusinessDescription: "",
      }],
    }));

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Profilens företagsnamn matchar inte Official Facts");
  });

  it("treats AB and Aktiebolag as the same official company-name suffix", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      categorySlug: "maleri",
      primarySniCode: "43.341",
      legalName: "Thomas Lundins Måleri & Fastighetsservice Aktiebolag",
      displayName: "Thomas Lundins Måleri & Fastighetsservice Aktiebolag",
      activityDescription: "Måleri, målning och fastighetsservice.",
      registeredNames: [{
        name: "THOMAS LUNDINS MÅLERI & FASTIGHETSSERVICE AB",
        specialBusinessDescription: "",
      }],
      sniCodes: [{ code: "43341", label: "Måleriarbeten" }],
    }));

    expect(result.level).toBe("high");
    expect(result.warnings).not.toContain("Profilens företagsnamn matchar inte Official Facts");
    expect(result.signals).toContain("Företagsnamnet matchar Official Facts");
  });

  it("caps confidence while Official Facts has not been enriched", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Rör & Värme AB",
      displayName: "Rör & Värme AB",
      activityDescription: "Rörinstallation och värme.",
      sniCodes: [],
    }));

    expect(result.score).toBe(80);
    expect(result.level).toBe("review");
    expect(result.officialFactsReady).toBe(false);
  });
});
