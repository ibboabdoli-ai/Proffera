import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public directory SEO hygiene", () => {
  it("uses the redirect target as the single platform origin", () => {
    expect(source("src/lib/site.ts")).toContain('url: "https://www.proffera.se"');
  });

  it("keeps noindex search routes out of the sitemap and emits both profile locales", () => {
    const sitemap = source("src/app/sitemap.ts");

    expect(sitemap).toContain("indexableLocalizedPublicRoutes");
    expect(sitemap).toContain('"/foretag/listad"');
    expect(sitemap).not.toContain('"/logga-in",');
    expect(sitemap).toContain('url: languages["sv-SE"]');
    expect(sitemap).toContain("url: languages.en");
    expect(sitemap).toContain("alternates: { languages }");
  });

  it("lets layout templates add the brand exactly once and overrides social metadata", () => {
    for (const path of [
      "src/app/foretag/listad/[slug]/page.tsx",
      "src/app/en/companies/[slug]/page.tsx",
    ]) {
      const profile = source(path);
      expect(profile).toContain("title: business.companyName");
      expect(profile).not.toContain("`${business.companyName} | Proffera`");
      expect(profile).toContain("twitter:");
    }
  });
});
