import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn(() => null) }));

import { DIRECTORY_LANDING_MIN_BUSINESSES, slugifyDirectoryLocation } from "@/lib/company-directory-landing-seo";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }

describe("Company Directory service-city SEO landings", () => {
  it("uses stable Swedish location slugs", () => {
    expect(slugifyDirectoryLocation("Södertälje")).toBe("sodertalje");
    expect(slugifyDirectoryLocation("Västra Frölunda")).toBe("vastra-frolunda");
  });

  it("requires a useful published-result floor and canonical public workplace location", () => {
    const helper = source("src/lib/company-directory-landing-seo.ts");
    const page = source("src/app/hitta/[service]/[location]/page.tsx");
    expect(DIRECTORY_LANDING_MIN_BUSINESSES).toBe(3);
    expect(helper).toContain("profile.publication_status = 'published'");
    expect(helper).toContain("profile.is_active = true");
    expect(helper).toContain("profile.privacy_blocked = false");
    expect(helper).toContain("company_directory_scb_enrichment");
    expect(helper).toContain("visitingAddress,city");
    expect(helper).toContain("claimed_workspace_id is null");
    expect(helper).toContain("having count(distinct id) >= ${DIRECTORY_LANDING_MIN_BUSINESSES}");
    expect(page).toContain("if (!landing) notFound()");
    expect(page).toContain("robots: { index: true, follow: true }");
  });

  it("adds only quality-gated landing URLs to the platform sitemap", () => {
    const sitemap = source("src/app/sitemap.ts");
    expect(sitemap).toContain("listDirectorySeoLandings");
    expect(sitemap).toContain("/hitta/${encodeURIComponent(landing.serviceSlug)}/${encodeURIComponent(landing.locationSlug)}");
  });
});
