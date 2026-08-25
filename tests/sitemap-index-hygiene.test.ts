import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("sitemap index hygiene", () => {
  it("does not advertise noindex search, login, registration or confirmation routes", () => {
    const sitemap = source("src/app/sitemap.ts");

    expect(sitemap).toContain('"/foretag/listad"');
    expect(sitemap).toContain('"/anslut-foretag/registrera"');
    expect(sitemap).toContain('"/anslut-foretag/tack"');
    expect(sitemap).toContain("indexableLocalizedPublicRoutes");
    expect(sitemap).not.toContain('"/logga-in",');
  });

  it("marks demo request and confirmation routes noindex in both languages", () => {
    for (const path of [
      "src/app/anslut-foretag/registrera/layout.tsx",
      "src/app/anslut-foretag/tack/layout.tsx",
      "src/app/en/join-business/register/layout.tsx",
      "src/app/en/join-business/thank-you/layout.tsx",
    ]) {
      const layout = source(path);
      expect(layout).toContain("index: false");
      expect(layout).toContain("follow: true");
    }
  });

  it("keeps public Directory profiles in the sitemap while search result URLs stay noindex", () => {
    const sitemap = source("src/app/sitemap.ts");
    const swedishSearch = source("src/app/foretag/listad/page.tsx");
    const englishSearch = source("src/app/en/companies/page.tsx");

    expect(sitemap).toContain("listPublishedDirectorySitemapEntries");
    expect(sitemap).toContain("const encodedSlug = encodeURIComponent(entry.slug)");
    expect(sitemap).toContain("/foretag/listad/${encodedSlug}");
    expect(sitemap).toContain("/en/companies/${encodedSlug}");
    expect(swedishSearch).toContain("index: false");
    expect(englishSearch).toContain("index: false");
  });

  it("limits Public Business sitemap entries to active non-test workspaces", () => {
    const seo = source("src/lib/public-business-seo.ts");

    expect(seo).toContain("where workspace.status = 'active'");
    expect(seo).toContain("isIndexablePublicBusinessWorkspace");
    expect(seo).toContain('companyName.startsWith("proffera test")');
  });
});
