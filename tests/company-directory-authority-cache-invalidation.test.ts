import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  fetchScb: vi.fn(),
  invalidateAuthorityCaches: vi.fn(),
  takeCompleteRecord: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-scb-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/company-directory-scb-provider")>()),
  fetchScbCompanyRegistryEnrichment: mocks.fetchScb,
}));
vi.mock("@/lib/company-directory-detail-cache", () => ({
  takeCompleteBolagsverketOrganizationRecord: mocks.takeCompleteRecord,
}));
vi.mock("@/lib/company-directory-official-facts-errors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/company-directory-official-facts-errors")>()),
  resolveBolagsverketOrganizationRecord: (value: unknown) => value,
}));
vi.mock("@/lib/company-directory-authority-cache", () => ({
  invalidateCompanyDirectoryAuthorityCachesBestEffort: mocks.invalidateAuthorityCaches,
}));

import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";
import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_NUMBER = "5563115707";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Company Directory authority-writer cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invalidateAuthorityCaches.mockResolvedValue(undefined);
  });

  it("invalidates after the committed SCB authority-changing write", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([{
        organization_number: ORGANIZATION_NUMBER,
        organization_kind: "juridical_person",
        legal_name: "Exempel AB",
        address_line1: "",
        postal_code: "",
        city: "",
        municipality: "",
        profile_updated_token: "2026-09-20 10:00:00+00",
        sni_codes: [],
        facts_last_synced_token: "2026-09-20 09:00:00+00",
      }])
      .mockResolvedValueOnce([{ authority_changed: true }]);
    mocks.getSql.mockReturnValue(sql);
    mocks.fetchScb.mockResolvedValue({
      status: "ok",
      data: {
        organizationNumber: ORGANIZATION_NUMBER,
        legalName: "Exempel AB",
        phone: null,
        email: null,
        postalAddress: { careOf: null, addressLine: null, postalCode: null, city: null },
        municipality: null,
        sniCodes: [],
        workplaces: [],
        source: "scb_foretagsregistret",
        provenance: {},
      },
    });

    await expect(enrichCompanyDirectoryScbForProfile(PROFILE_ID)).resolves.toMatchObject({
      status: "saved",
      saved: true,
    });

    expect(mocks.invalidateAuthorityCaches).toHaveBeenCalledWith(
      PROFILE_ID,
      "committed SCB authority change",
    );
    expect(sql.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.invalidateAuthorityCaches.mock.invocationCallOrder[0]!,
    );
  });

  it("invalidates after the committed Official Facts replacement", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([{ organization_number: ORGANIZATION_NUMBER }])
      .mockResolvedValueOnce([{ authority_changed: true }]);
    mocks.getSql.mockReturnValue(sql);
    mocks.takeCompleteRecord.mockReturnValue({
      organisationsnummer: ORGANIZATION_NUMBER,
      reklamsparr: { kod: "NEJ" },
    });

    await expect(enrichCompanyDirectoryOfficialFactsForProfile(PROFILE_ID)).resolves.toMatchObject({
      profileId: PROFILE_ID,
      organizationNumber: ORGANIZATION_NUMBER,
      reusedVerifiedDetail: true,
    });

    expect(mocks.invalidateAuthorityCaches).toHaveBeenCalledWith(
      PROFILE_ID,
      "committed Official Facts authority change",
    );
    expect(sql.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.invalidateAuthorityCaches.mock.invocationCallOrder[0]!,
    );
  });

  it("does not invalidate after a timestamp-only Official Facts refresh", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([{ organization_number: ORGANIZATION_NUMBER }])
      .mockResolvedValueOnce([{ authority_changed: false }]);
    mocks.getSql.mockReturnValue(sql);
    mocks.takeCompleteRecord.mockReturnValue({
      organisationsnummer: ORGANIZATION_NUMBER,
      reklamsparr: { kod: "NEJ" },
    });

    await expect(enrichCompanyDirectoryOfficialFactsForProfile(PROFILE_ID)).resolves.toMatchObject({
      profileId: PROFILE_ID,
      organizationNumber: ORGANIZATION_NUMBER,
      reusedVerifiedDetail: true,
    });

    expect(mocks.invalidateAuthorityCaches).not.toHaveBeenCalled();
  });

  it("keeps claim reservation bookkeeping out of the publication authority token", () => {
    const marketplaceClaim = source("src/lib/company-directory-marketplace-claim.ts");
    const adminClaim = source("src/lib/company-directory-claims-admin.ts");

    const marketplaceRelease = marketplaceClaim.slice(
      marketplaceClaim.indexOf("async function releaseOwnReservation"),
      marketplaceClaim.indexOf("async function cleanupProvisionedMarketplaceWorkspace"),
    );
    const adminRelease = adminClaim.slice(
      adminClaim.indexOf("export async function releaseStaleCompanyDirectoryClaimReservation"),
      adminClaim.indexOf("export async function approveAndProvisionCompanyDirectoryClaim"),
    );

    expect(marketplaceRelease).toContain("claim_reserved_at = null");
    expect(marketplaceRelease).not.toContain("updated_at = now()");
    expect(adminRelease).toContain("claim_reserved_at = null");
    expect(adminRelease).not.toContain("updated_at = now()");

    // Final ownership/publication transitions still advance updated_at.
    expect(marketplaceClaim).toMatch(/publication_status = 'claimed',\s*updated_at = now\(\)/);
    expect(adminClaim).toMatch(/publication_status = 'claimed',\s*updated_at = now\(\)/);
  });

});
