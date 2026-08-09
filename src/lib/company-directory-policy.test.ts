import { describe, expect, it } from "vitest";

import {
  assessDirectoryCandidate,
  buildDirectoryPublicSlug,
  classifyOrganizationKind,
  mapSniToDirectoryCategory,
  normalizeSniCode,
  type NormalizedDirectoryCandidate,
} from "@/lib/company-directory-policy";

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
  });

  it("maps supported service-company SNI codes deterministically", () => {
    expect(mapSniToDirectoryCategory("81.210")?.categorySlug).toBe("stadning");
    expect(mapSniToDirectoryCategory("49.420")?.categorySlug).toBe("flytt");
    expect(mapSniToDirectoryCategory("43.210")?.categorySlug).toBe("elektriker");
    expect(mapSniToDirectoryCategory("43.221")?.categorySlug).toBe("vvs");
    expect(mapSniToDirectoryCategory("43.341")?.categorySlug).toBe("maleri");
    expect(mapSniToDirectoryCategory("43.320")?.categorySlug).toBe("snickeri");
    expect(mapSniToDirectoryCategory("81.300")?.categorySlug).toBe("tradgard");
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

  it("marks a complete active juridical company ready", () => {
    const assessment = assessDirectoryCandidate(candidate());
    expect(assessment.score).toBeGreaterThanOrEqual(80);
    expect(assessment.autoPublicEligible).toBe(true);
    expect(assessment.publicationStatus).toBe("ready");
  });

  it("does not publish an unsupported industry", () => {
    const assessment = assessDirectoryCandidate(candidate({ primarySniCode: "62.100" }));
    expect(assessment.autoPublicEligible).toBe(false);
    expect(assessment.publicationStatus).toBe("review");
  });

  it("builds stable non-personal public slugs", () => {
    expect(buildDirectoryPublicSlug(candidate())).toBe("exempel-stad-ab-123456");
  });
});
