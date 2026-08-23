import { describe, expect, it } from "vitest";

import {
  assessCompanyDirectoryCategoryConfidence,
  COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION,
} from "@/lib/company-directory-category-confidence";

describe("Company Directory Swedish painting keyword regression", () => {
  it("does not treat Mälar place-name compounds as Måleri evidence", () => {
    const result = assessCompanyDirectoryCategoryConfidence({
      categorySlug: "stadning",
      primarySniCode: "81.221",
      legalName: "BELFOR Sweden AB",
      displayName: "BELFOR Sweden AB",
      activityDescription: "Bolaget utför industriell rengöring och skadesanering.",
      registeredNames: [
        {
          name: "BELFOR Sweden AB",
          typeCode: "FORETAGSNAMN",
          specialBusinessDescription: "",
        },
        {
          name: "Mälarsanering",
          typeCode: "SARS_FORNAMN",
          specialBusinessDescription: "För den del av verksamheten som avser sanering.",
        },
      ],
      sniCodes: [{ code: "81221", label: "Rengöring av byggnader" }],
    });

    expect(result.level).toBe("high");
    expect(result.score).toBe(100);
    expect(result.conflictingTextCategories).not.toContain("maleri");
  });

  it("still recognizes genuine Swedish Måleri and Målar compounds", () => {
    const result = assessCompanyDirectoryCategoryConfidence({
      categorySlug: "maleri",
      primarySniCode: "43.341",
      legalName: "Stockholms Målarservice AB",
      displayName: "Stockholms Målarservice AB",
      activityDescription: "Måleriarbeten och målning av bostäder.",
      registeredNames: [{
        name: "Stockholms Målarservice AB",
        typeCode: "FORETAGSNAMN",
        specialBusinessDescription: "",
      }],
      sniCodes: [{ code: "43341", label: "Måleriarbeten" }],
    });

    expect(result.level).toBe("high");
    expect(result.score).toBe(100);
  });

  it("recognizes supported unaccented painting spellings", () => {
    for (const term of ["maleri", "malare", "malning"]) {
      const result = assessCompanyDirectoryCategoryConfidence({
        categorySlug: "maleri",
        primarySniCode: "43.341",
        legalName: "Exempel Färg AB",
        displayName: "Exempel Färg AB",
        activityDescription: `Företaget arbetar med ${term} av bostäder.`,
        registeredNames: [{
          name: "Exempel Färg AB",
          typeCode: "FORETAGSNAMN",
          specialBusinessDescription: "",
        }],
        sniCodes: [{ code: "43341", label: "Måleriarbeten" }],
      });

      expect(result.signals).toContain("Verksamhetsbeskrivningen stödjer kategorin");
      expect(result.level).toBe("high");
    }
  });

  it("does not count Mälarsanering as a Måleri name signal on a painting profile", () => {
    const result = assessCompanyDirectoryCategoryConfidence({
      categorySlug: "maleri",
      primarySniCode: "43.341",
      legalName: "Mälarsanering AB",
      displayName: "Mälarsanering AB",
      activityDescription: "Bolaget utför måleriarbeten och målning av bostäder.",
      registeredNames: [{
        name: "Mälarsanering AB",
        typeCode: "FORETAGSNAMN",
        specialBusinessDescription: "",
      }],
      sniCodes: [{ code: "43341", label: "Måleriarbeten" }],
    });

    expect(result.signals).toContain("Verksamhetsbeskrivningen stödjer kategorin");
    expect(result.signals).not.toContain("Företagsnamn stödjer kategorin");
    expect(result.level).toBe("high");
  });

  it("exposes an explicit policy version for background re-evaluation", () => {
    expect(COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});
