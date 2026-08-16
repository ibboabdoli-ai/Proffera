import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("hybrid directory marketplace search", () => {
  const searchSource = source("src/lib/company-directory-public-search.ts");
  const resultsSource = source("src/components/company-directory/public-directory-results.tsx");
  const copySource = source("src/components/company-directory/public-directory-copy.ts");

  it("keeps unclaimed published profiles and safely re-introduces claimed workspaces", () => {
    expect(searchSource).toContain("profile.publication_status = 'published'");
    expect(searchSource).toContain("profile.publication_status = 'claimed'");
    expect(searchSource).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(searchSource).toContain("claimed_workspace.status in ('active', 'trial')");
    expect(searchSource).toContain("profile.is_active = true");
    expect(searchSource).toContain("profile.privacy_blocked = false");
  });

  it("requires an exact published workspace-service mapping instead of guessing", () => {
    expect(searchSource).toContain("claimed_service.is_active = true");
    expect(searchSource).toContain("claimed_service.public_status = 'published'");
    expect(searchSource).toContain("claimed_service.public_slug = relation.service_slug");
    expect(searchSource).toContain("and claimed_service.id is not null");
  });

  it("requires the canonical public website entitlement before exposing a claimed workspace", () => {
    expect(searchSource).toContain("hasWorkspaceFeatureAccessForWorkspace");
    expect(searchSource).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder")');
    expect(searchSource).toContain("if (isClaimed && !access?.websiteBuilder) return []");
  });

  it("only exposes direct booking when the canonical booking entitlement and booking slug are present", () => {
    expect(searchSource).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking")');
    expect(searchSource).toContain("claimedBookingSlug");
    expect(searchSource).toContain('conversionMode === "book" || conversionMode === "book_or_quote"');
    expect(resultsSource).toContain("result.bookingAvailable && result.claimedBookingSlug");
    expect(resultsSource).toContain("service_id: result.claimedServiceId");
  });

  it("routes claimed results to their real company/service actions and preserves directory fallback", () => {
    expect(resultsSource).toContain("/foretag/${workspaceSlug}");
    expect(resultsSource).toContain("/foretag/${workspaceSlug}/tjanster/${serviceSlug}");
    expect(resultsSource).toContain("#offert");
    expect(resultsSource).toContain("#kontaktforfragan");
    expect(resultsSource).toContain("/boka/${encodeURIComponent(result.claimedBookingSlug)}");
    expect(resultsSource).toContain("${profileBase}/${encodeURIComponent(result.slug)}");
    expect(copySource).toContain('requestQuote: "Begär offert"');
    expect(copySource).toContain('book: "Boka"');
    expect(copySource).toContain('contact: "Kontakta"');
  });
});
