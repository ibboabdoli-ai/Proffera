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
  const publicDataSource = source("src/lib/company-directory-public-data.ts");
  const routingSource = source("src/lib/company-directory-routing.ts");
  const profileSource = source("src/components/company-directory/public-directory-profile.tsx");

  it("keeps unclaimed published profiles and safe previously-published claimed profiles searchable", () => {
    expect(searchSource).toContain("profile.publication_status = 'published'");
    expect(searchSource).toContain("profile.publication_status = 'claimed'");
    expect(searchSource).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(searchSource).toContain("profile.published_at is not null");
    expect(searchSource).toContain("profile.auto_public_eligible = true");
    expect(searchSource).toContain("claimed_workspace.status in ('active', 'trial')");
    expect(searchSource).toContain("profile.is_active = true");
    expect(searchSource).toContain("profile.privacy_blocked = false");
  });

  it("keeps a claimed Starter company on the safe Directory fallback instead of requiring Business Page access", () => {
    expect(publicDataSource).toContain("getSafeClaimedDirectoryFallback");
    expect(publicDataSource).toContain("profile.publication_status = 'claimed'");
    expect(publicDataSource).toContain("profile.published_at is not null");
    expect(publicDataSource).toContain("profile.auto_public_eligible = true");
    expect(publicDataSource).toContain("profile.privacy_blocked = false");
    expect(profileSource).toContain('business.publicationStatus !== "claimed"');
  });

  it("only upgrades a claimed result to Marketplace actions with an exact published workspace-service mapping", () => {
    expect(searchSource).toContain("claimed_service.is_active = true");
    expect(searchSource).toContain("claimed_service.public_status = 'published'");
    expect(searchSource).toContain("claimed_service.public_slug = relation.service_slug");
    expect(searchSource).toContain("const marketplaceAvailable = Boolean(");
    expect(searchSource).toContain("&& row.claimed_service_id");
    expect(searchSource).toContain("&& row.claimed_service_slug");
    expect(searchSource).toContain("claimedWorkspaceSlug: marketplaceAvailable");
  });

  it("requires canonical Business Page access before Marketplace routing or redirect", () => {
    expect(searchSource).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder")');
    expect(searchSource).toContain("&& access?.websiteBuilder");
    expect(routingSource).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder")');
    expect(routingSource).toContain("return websiteBuilder ? workspaceSlug : null");
  });

  it("only exposes direct booking when canonical booking access and booking slug are present", () => {
    expect(searchSource).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking")');
    expect(searchSource).toContain("claimedBookingSlug");
    expect(searchSource).toContain('conversionMode === "book" || conversionMode === "book_or_quote"');
    expect(resultsSource).toContain("result.bookingAvailable && result.claimedBookingSlug");
    expect(resultsSource).toContain("service_id: result.claimedServiceId");
  });

  it("routes Marketplace results to real service actions and preserves Directory fallback", () => {
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
