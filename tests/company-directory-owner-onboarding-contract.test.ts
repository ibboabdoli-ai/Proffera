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

  it("deduplicates locally, resumes eligible ready profiles and reuses canonical publication gates", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-owner-onboarding.ts"),
      "utf8",
    );

    expect(source).toContain("lookupProfileState(organizationNumber)");
    expect(source).toContain("resumeReadyProfile(existing, access.workspaceId, access.userId)");
    expect(source).toContain('profile.publicationStatus !== "ready"');
    expect(source).toContain('profile.organizationKind !== "juridical_person"');
    expect(source).toContain("enrichCompanyDirectoryOfficialFactsForProfile(profile.profileId)");
    expect(source).toContain("autoPublishCompanyDirectoryProfileIfSafe(profile.profileId)");
    expect(source).toContain('profile.publicationStatus !== "published"');
    expect(source).toContain("profile.privacyBlocked");
    expect(source).toContain("!profile.autoPublicEligible");
  });

  it("uses the existing durable database-backed rate limiter before owner-triggered official lookups", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/company-directory-owner-onboarding.ts"),
      "utf8",
    );

    expect(source).toContain('scope: "owner_directory_onboarding"');
    expect(source).toContain("allowPublicSubmission");
    expect(source).toContain("maxAttempts: 6");
    expect(source).toContain("windowSeconds: 60 * 60");
    expect(source).toContain('throw new Error("rate_limited")');

    const rateGuard = source.lastIndexOf("await requireExternalLookupBudget({ workspaceId: access.workspaceId, userId: access.userId })");
    const officialLookup = source.indexOf("verifyOfficialCompanyCandidate(seedCandidate(organizationNumber))");
    expect(rateGuard).toBeGreaterThan(-1);
    expect(officialLookup).toBeGreaterThan(-1);
    expect(rateGuard).toBeLessThan(officialLookup);
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
