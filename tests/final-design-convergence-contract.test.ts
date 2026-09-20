import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketplaceCompanyCover } from "../src/components/marketplace/marketplace-company-media";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const legacyPalette = ["#17452f", "#17201a", "#102a1c", "#f6f8f4", "#f7f7f4", "#e8c678"];

describe("final Proffera design convergence", () => {
  it("uses the approved navy marketplace tokens globally", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain("--pf-brand: #1469d8");
    expect(css).toContain("--pf-brand-deep: #0a2e63");
    expect(css).toContain("--pf-canvas: #f6f9fd");
    expect(css).toContain("--pf-ink: #11213b");
    expect(css).toContain("--pf-line: #dce4ee");
    expect(css).toContain("--pf-radius-panel: 1rem");
  });

  it("removes the legacy green visual language from remaining public marketing surfaces", () => {
    const paths = [
      "src/app/om/page.tsx",
      "src/app/en/about/page.tsx",
      "src/app/tjanster/page.tsx",
      "src/app/branscher/page.tsx",
      "src/components/marketing/marketing-features.tsx",
      "src/components/marketing/marketing-industries.tsx",
      "src/components/marketing/marketing-pricing.tsx",
      "src/components/marketing/marketing-demo.tsx",
      "src/components/layout/header.tsx",
      "src/components/layout/footer.tsx",
    ];

    for (const path of paths) {
      const value = source(path).toLowerCase();
      for (const legacy of legacyPalette) expect(value).not.toContain(legacy);
    }
  });

  it("keeps public marketing layouts restrained instead of reverting to oversized generic card grids", () => {
    const css = source("src/components/marketing/platform-marketing.module.css");
    const features = source("src/components/marketing/marketing-features.tsx");
    const industries = source("src/components/marketing/marketing-industries.tsx");
    const demo = source("src/components/marketing/marketing-demo.tsx");

    expect(css).toContain("#0a2e63");
    expect(css).toContain("#1469d8");
    expect(css).toContain(".editorialList");
    expect(css).toContain(".valueList");
    expect(css).not.toContain("linear-gradient");
    expect(features).toContain("styles.editorialList");
    expect(industries).toContain("styles.editorialList");
    expect(demo).toContain("styles.editorialList");
  });

  it("renders a labelled service illustration when a company has no trusted photo", () => {
    const html = renderToStaticMarkup(createElement(MarketplaceCompanyCover, {
      name: "Rörfixarna AB",
      serviceSlug: "vvs",
    }));
    const results = source("src/components/company-directory/public-directory-results.tsx");
    const home = source("src/components/marketplace/marketplace-home.tsx");

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Illustration: Rörfixarna AB"');
    expect(html).toContain("lucide-wrench");
    expect(html).not.toContain("<img");
    expect(results).toContain("illustration={!trustedCardMedia}");
    expect(results).toContain("serviceSlug={result.matchedServiceSlug}");
    expect(home).toContain('coverMedia?.role === "illustration" || !coverMedia?.url');
  });

  it("aligns browser and share surfaces to the same brand", () => {
    const layout = source("src/app/layout.tsx");
    const manifest = source("src/app/manifest.ts");
    const og = source("src/app/og/route.tsx");
    const logo = source("public/brand/proffera-logo.svg");
    const icon = source("public/brand/proffera-app-icon.svg");

    expect(layout).toContain('themeColor: "#0a2e63"');
    expect(manifest).toContain('background_color: "#f6f9fd"');
    expect(manifest).toContain('theme_color: "#0a2e63"');
    expect(og).toContain("#0a2e63");
    expect(logo).toContain("#0a2e63");
    expect(icon).toContain('fill="#0a2e63"');
  });
});
