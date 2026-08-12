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
  it("gives high confidence when official SNI and business text corroborate VVS", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Carl Hanssons Rör & Värme Aktiebolag",
      displayName: "Carl Hanssons Rör & Värme Aktiebolag",
      activityDescription: "Bolaget utför rörinstallationer, värme och sanitetsarbeten.",
    }));

    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
    expect(result.officialFactsReady).toBe(true);
  });

  it("keeps a generic business name at manual-review confidence when only SNI supports the category", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Consulting & Management Holding CM AB",
      displayName: "Consulting & Management Holding CM AB",
      activityDescription: "Konsultverksamhet och företagsledning.",
    }));

    expect(result.score).toBe(80);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Ingen oberoende textsignal stödjer kategorin");
  });

  it("penalizes competing supported categories in the official SNI list", () => {
    const result = assessCompanyDirectoryCategoryConfidence(base({
      legalName: "Rör & Elservice AB",
      displayName: "Rör & Elservice AB",
      activityDescription: "VVS, rörinstallation och värmeservice.",
      sniCodes: [
        { code: "43221", label: "Värme- och sanitetsarbeten" },
        { code: "43210", label: "Elinstallationer" },
      ],
    }));

    expect(result.score).toBe(95);
    expect(result.level).toBe("high");
    expect(result.competingCategories).toEqual(["elektriker"]);
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
