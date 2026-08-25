import { describe, expect, it } from "vitest";

import {
  assessCompanyDirectoryCategoryConfidence,
  COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION,
} from "@/lib/company-directory-category-confidence";

function assess(input: {
  legalName: string;
  activityDescription: string;
}) {
  return assessCompanyDirectoryCategoryConfidence({
    categorySlug: "elektriker",
    primarySniCode: "43.210",
    legalName: input.legalName,
    displayName: input.legalName,
    activityDescription: input.activityDescription,
    registeredNames: [],
    sniCodes: [{ code: "43.210", label: "Elinstallationer" }],
  });
}

describe("company directory electrician Production regressions", () => {
  it("bumps the category policy so already evaluated profiles are reconsidered", () => {
    expect(COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION).toBe("2026-08-25.2");
  });

  it.each([
    {
      legalName: "Mellett Electrical Sweden Filial",
      activityDescription: "Filialen ska bedriva elektriska installationer.",
    },
    {
      legalName: "Kornelinds Elektriska AB",
      activityDescription: "Förmålet för bolagets verksamhet är att bedriva elarbeten och övriga byggnadsarbeten.",
    },
    {
      legalName: "Södertälje Elektriska AB",
      activityDescription: "Bolaget ska bedriva installationsrörelse inom el, tele, data och larm.",
    },
    {
      legalName: "Elsmart Elektronik Sverige AB",
      activityDescription: "Bolaget skall bedriva installation, service och underhåll av elektriska anläggningar.",
    },
  ])("keeps verified electrician service wording high-confidence: $legalName", (input) => {
    const result = assess(input);

    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it.each([
    "Palmgren & Larsson Elektriska Aktiebolag",
    "CCS Elektriska AB",
    "Mellett Electrical Sweden Filial",
  ])("accepts explicit electrician trade wording in a company name: %s", (legalName) => {
    const result = assess({
      legalName,
      activityDescription: "",
    });

    expect(result.level).toBe("high");
    expect(result.signals).toContain("Företagsnamn stödjer kategorin");
  });

  it.each([
    {
      legalName: "Elektronikhandel Sverige AB",
      activityDescription: "Bolaget säljer elektronik och hushållsapparater.",
    },
    {
      legalName: "Exempel AB",
      activityDescription: "Service av elektriska hushållsapparater.",
    },
    {
      legalName: "Exempel AB",
      activityDescription: "Bolaget utför elektroniska installationer och säljer elektronikprodukter.",
    },
  ])("keeps electronics and appliance wording in Review: $legalName", (input) => {
    const result = assess(input);

    expect(result.score).toBe(90);
    expect(result.level).toBe("review");
    expect(result.warnings).toContain("Ingen oberoende textsignal stödjer kategorin");
  });
});
