import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public Business Hub SEO contract", () => {
  it("indexes only published active services from website-enabled workspaces", () => {
    const seo = source("src/lib/public-business-seo.ts");
    const sitemap = source("src/app/sitemap.ts");

    expect(seo).toContain("service.is_active = true");
    expect(seo).toContain("service.public_status = 'published'");
    expect(seo).toContain("service.public_slug is not null");
    expect(seo).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder")');
    expect(sitemap).toContain("listPublicBusinessSitemapEntries");
    expect(sitemap).toContain("/foretag/${encodeURIComponent(entry.workspaceSlug)}");
  });

  it("uses a single clean canonical URL for locale query variants", () => {
    const companyPage = source("src/app/foretag/[workspace]/page.tsx");
    const servicePage = source("src/app/foretag/[workspace]/tjanster/[service]/page.tsx");

    expect(companyPage).toContain("alternates: { canonical: urls.companyCanonical }");
    expect(servicePage).toContain("alternates: { canonical }");
    expect(companyPage).not.toContain("alternates: { languages:");
    expect(servicePage).not.toContain("alternates: { languages:");
  });

  it("emits sanitized LocalBusiness and Service JSON-LD", () => {
    const seo = source("src/lib/public-business-seo.ts");
    const companyPage = source("src/app/foretag/[workspace]/page.tsx");
    const servicePage = source("src/app/foretag/[workspace]/tjanster/[service]/page.tsx");

    expect(seo).toContain('"@type": "LocalBusiness"');
    expect(seo).toContain('"@type": "Service"');
    expect(seo).toContain('JSON.stringify(value).replace(/</g, "\\\\u003c")');
    expect(companyPage).toContain('type="application/ld+json"');
    expect(servicePage).toContain('type="application/ld+json"');
  });

  it("gives website-mode custom domains clean service URLs without changing platform routes", () => {
    const proxy = source("src/proxy.ts");
    const seo = source("src/lib/public-business-seo.ts");

    expect(proxy).toContain('pathname.startsWith("/tjanster/")');
    expect(proxy).toContain('target.publicHomeMode !== "website"');
    expect(proxy).toContain("/foretag/${encodeURIComponent(target.workspaceSlug)}/tjanster/${encodeURIComponent(serviceSlug)}");
    expect(seo).toContain('target.publicHomeMode === "website"');
    expect(seo).toContain('serviceHref: (serviceSlug) => `/tjanster/${encodeURIComponent(serviceSlug)}`');
  });

  it("serves host-aware sitemap and robots metadata for customer domains", () => {
    const sitemap = source("src/app/sitemap.ts");
    const robots = source("src/app/robots.ts");

    expect(sitemap).toContain("resolvePublicCustomDomain(host)");
    expect(sitemap).toContain('url: `${origin}/tjanster/${encodeURIComponent(service.publicSlug)}`');
    expect(robots).toContain("resolvePublicCustomDomain(host)");
    expect(robots).toContain('disallow: ["/admin/", "/api/", "/app/", "/dashboard/", "/demo/", "/foretag/"]');
  });
});
