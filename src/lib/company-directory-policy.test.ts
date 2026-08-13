import { describe, expect, it } from "vitest";

import {
  assessDirectoryCandidate,
  buildDirectoryPublicSlug,
  classifyOrganizationKind,
  isDirectoryPilotLocation,
  mapSniToDirectoryCategory,
  normalizeSniCode,
  type NormalizedDirectoryCandidate,
} from "./company-directory-policy";

function candidate(overrides: Partial<NormalizedDirectoryCandidate> = {}): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber: "559123-4567",
    organizationKind: "juridical_person",
    legalName: "Exempel Städ AB",
    displayName: "Exempel Städ AB",
    legalForm: "Aktiebolag",
    organizationStatus: "Registrerad",
    isActive: true,
    fTaxStatus: "Registrerad",
    vatStatus: "Registrerad",
    employerStatus: "Registrerad",
    primarySniCode: "81.210",
    primarySniLabel: "Lokalvård",
    activityDescription: "Lokalvård för företag och hushåll.",
    addressLine1: "Exempelvägen 1",
    postalCode: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
    region: "Stockholms län",
    officialSource: "bolagsverket_vardefulla_datamangder",
    sourceRecordId: "5591234567",
    sourceUpdatedAt: new Date("2026-08-09T00:00:00Z"),
    ...overrides,
  };
}

describe("company directory policy", () => {
  it("normalizes current SNI2025 codes", () => {
    expect(normalizeSniCode("81210")).toBe("81.210");
    expect(normalizeSniCode("49.420")).toBe("49.420");
    expect(normalizeSniCode("96910")).toBe("96.910");
  });

  it("maps supported service-company SNI codes deterministically", () => {
    expect(mapSniToDirectoryCategory("81.210")?.categorySlug).toBe("stadning");
    expect(mapSniToDirectoryCategory("81.221")?.categorySlug).toBe("stadning");
    expect(mapSniToDirectoryCategory("81.222")).toBeNull();
    expect(mapSniToDirectoryCategory("96.910")?.categorySlug).toBe("hemservice");
    expect(mapSniToDirectoryCategory("49.420")?.categorySlug).toBe("flytt");
    expect(mapSniToDirectoryCategory("43.210")?.categorySlug).toBe("elektriker");
    expect(mapSniToDirectoryCategory("43.221")?.categorySlug).toBe("vvs");
    expect(mapSniToDirectoryCategory("43.341")?.categorySlug).toBe("maleri");
    expect(mapSniToDirectoryCategory("43.320")?.categorySlug).toBe("snickeri");
    expect(mapSniToDirectoryCategory("81.300")?.categorySlug).toBe("tradgard");
  });

  it("uses SNI only for broad category inference, never granular services", () => {
    const supportedCodes = [
      "81.210",
      "81.221",
      "96.910",
      "49.420",
      "43.210",
      "43.221",
      "43.341",
      "43.320",
      "81.300",
    ];

    for (const code of supportedCodes) {
      expect(mapSniToDirectoryCategory(code)?.serviceSlugs).toEqual([]);
    }
  });

  it("keeps broad household services distinct from the cleaning category", () => {
    const homeService = mapSniToDirectoryCategory("96.910");
    expect(homeService?.categoryLabel).toBe("Hemservice");
    expect(homeService?.serviceSlugs).toEqual([]);
  });

  it("blocks sole traders from automatic public publication", () => {
    expect(classifyOrganizationKind("Enskild näringsidkare")).toBe("sole_trader");
    const assessment = assessDirectoryCandidate(candidate({
      organizationKind: "sole_trader",
      legalForm: "Enskild näringsidkare",
    }));
    expect(assessment.privacyBlocked).toBe(true);
    expect(assessment.autoPublicEligible).toBe(false);
    expect(assessment.publicationStatus).toBe("blocked");
  });

  it("treats registered foreign branches as non-personal organizations", () => {
    expect(classifyOrganizationKind("Filial")).toBe("juridical_person");
    const assessment = assessDirectoryCandidate(candidate({
      organizationKind: classifyOrganizationKind("Filial"),
      legalForm: "Filial",
      fTaxStatus: "",
      vatStatus: "",
      employerStatus: "",
    }));
    expect(assessment.privacyBlocked).toBe(false);
    expect(assessment.autoPublicEligible).toBe(true);
    expect(assessment.publicationStatus).toBe("ready");
  });

  it("marks a complete active juridical company inside the pilot ready", () => {
    const assessment = assessDirectoryCandidate(candidate());
    expect(isDirectoryPilotLocation(candidate())).toBe(true);
    expect(assessment.score).toBeGreaterThanOrEqual(80);
    expect(assessment.autoPublicEligible).toBe(true);
    expect(assessment.publicationStatus).toBe("ready");
  });

  it("keeps a company in review when Official Facts does not confirm SCB Ng1", () => {
    const assessment = assessDirectoryCandidate(candidate({ primarySniVerified: false }));

    expect(assessment.reasons).toContain("primary_sni_not_confirmed");
    expect(assessment.autoPublicEligible).toBe(false);
    expect(assessment.publicationStatus).toBe("review");
  });

  it("uses the HVD active signal when individual tax fields are unavailable", () => {
    const assessment = assessDirectoryCandidate(candidate({
      fTaxStatus: "",
      vatStatus: "",
      employerStatus: "",
    }));
    expect(assessment.reasons).not.toContain("tax_status_not_confirmed");
    expect(assessment.score).toBe(100);
    expect(assessment.autoPublicEligible).toBe(true);
    expect(assessment.publicationStatus).toBe("ready");
  });

  it("keeps otherwise valid companies outside Stockholm and Södertälje out of auto-publication", () => {
    const outside = candidate({ city: "Malmö", municipality: "Malmö" });
    const assessment = assessDirectoryCandidate(outside);
    expect(isDirectoryPilotLocation(outside)).toBe(false);
    expect(assessment.reasons).toContain("outside_pilot_area");
    expect(assessment.autoPublicEligible).toBe(false);
    expect(assessment.publicationStatus).toBe("review");
  });

  it("does not award tax quality points when explicit registration details are all negative", () => {
    const positive = assessDirectoryCandidate(candidate());
    const negative = assessDirectoryCandidate(candidate({
      fTaxStatus: "Ej registrerad",
      vatStatus: "Inte registrerad",
      employerStatus: "Ej registrerad",
    }));
    expect(negative.reasons).toContain("tax_status_not_confirmed");
    expect(positive.score - negative.score).toBe(5);
  });

  it("does not publish an unsupported industry", () => {
    const assessment = assessDirectoryCandidate(candidate({ primarySniCode: "62.100" }));
    expect(assessment.autoPublicEligible).toBe(false);
    expect(assessment.publicationStatus).toBe("review");
  });

  it("builds stable public slugs for juridical companies", () => {
    expect(buildDirectoryPublicSlug(candidate())).toBe("exempel-stad-ab-234567");
  });
});
