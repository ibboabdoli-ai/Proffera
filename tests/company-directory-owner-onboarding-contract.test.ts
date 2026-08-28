import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("owner-initiated company Directory onboarding", () => {
  it("verifies an exact Swedish organisation number through the official source before persistence", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-owner-onboarding.ts"),
      "utf8",
    );

    expect(source).toContain("normalizeSwedishOrganizationNumber");
    expect(source).toContain("verifyOfficialCompanyCandidate(seedCandidate(organizationNumber))");
    expect(source).toContain("upsertCompanyDirectoryCandidate(verified)");
    expect(source.indexOf("verifyOfficialCompanyCandidate(seedCandidate(organizationNumber))"))
      .toBeLessThan(source.indexOf("upsertCompanyDirectoryCandidate(verified)"));
  });

  it("deduplicates locally before official ingestion and reuses the canonical publication gates", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-owner-onboarding.ts"),
      "utf8",
    );

    expect(source).toContain("lookupExistingProfile(organizationNumber, access.workspaceId)");
    expect(source).toContain("enrichCompanyDirectoryOfficialFactsForProfile(upserted.profileId)");
    expect(source).toContain("autoPublishCompanyDirectoryProfileIfSafe(upserted.profileId)");
    expect(source).toContain('String(row.publication_status) !== "published"');
    expect(source).toContain("Boolean(row.privacy_blocked)");
    expect(source).toContain("!Boolean(row.auto_public_eligible)");
  });

  it("fails closed for sole traders before the generic profile upsert", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-owner-onboarding.ts"),
      "utf8",
    );

    const soleTraderGuard = source.indexOf('verified.organizationKind !== "juridical_person"');
    const upsert = source.indexOf("upsertCompanyDirectoryCandidate(verified)");

    expect(soleTraderGuard).toBeGreaterThan(-1);
    expect(upsert).toBeGreaterThan(-1);
    expect(soleTraderGuard).toBeLessThan(upsert);
    expect(source).toContain('status: "sole_trader_privacy"');
  });

  it("keeps the owner UI server-posted and routes eligible companies into the existing claim flow", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/app/dashboard/marknadsplats/lagg-till-foretag/page.tsx"),
      "utf8",
    );

    expect(page).toContain('"use server"');
    expect(page).toContain("onboardOwnerCompanyByOrganizationNumber");
    expect(page).toContain("/foretag/claim/");
    expect(page).toContain("/en/companies/claim/");
    expect(page).toContain("Namn, adress eller andra fritextfält");
    expect(page).not.toContain('params.set("organizationNumber"');
  });
});
