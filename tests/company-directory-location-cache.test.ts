import { describe, expect, it, vi } from "vitest";

import type { NormalizedDirectoryCandidate } from "@/lib/company-directory-policy";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { PUBLISHED_DIRECTORY_LOCATION_SUGGESTIONS_TAG } from "@/lib/company-directory-cache";
import { upsertCompanyDirectoryCandidate } from "@/lib/company-directory-engine";

function candidate(): NormalizedDirectoryCandidate {
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
    sourceUpdatedAt: new Date("2026-08-20T00:00:00Z"),
  };
}

describe("public directory location cache", () => {
  it("expires location suggestions immediately after the profile write succeeds", async () => {
    let call = 0;
    const sql = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return [{
          id: "11111111-1111-4111-8111-111111111111",
          publication_status: "ready",
          category_slug: "stadning",
        }];
      }
      throw new Error("later related write failed");
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(upsertCompanyDirectoryCandidate(candidate())).rejects.toThrow("later related write failed");
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      PUBLISHED_DIRECTORY_LOCATION_SUGGESTIONS_TAG,
      { expire: 0 },
    );
  });
});
