import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Readability and contrast hardening", () => {
  it("publishes the semantic color aliases used by public directory and workspace UI", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain("--pf-body: #455249");
    expect(css).toContain("--pf-ink-muted: #4f5c53");
    expect(css).toContain("--color-body: var(--pf-body)");
    expect(css).toContain("--color-muted: var(--pf-ink-muted)");
    expect(css).toContain("--color-brand-strong: var(--pf-brand-hover)");
    expect(css).toContain("--shadow-panel: var(--pf-shadow-lift)");
  });

  it("prevents light CTAs inside dark cards from inheriting white WebKit text fill", () => {
    const css = source("src/app/globals.css");
    const dashboard = source("src/app/dashboard/page.tsx");
    const profile = source("src/components/company-directory/public-directory-profile.tsx");

    expect(css).toContain('[class*="bg-white"][class~="text-brand-deep"]');
    expect(css).toContain('[class~="bg-surface"][class~="text-brand-deep"]');
    expect(css).toContain("-webkit-text-fill-color: var(--pf-brand-deep) !important");
    expect(dashboard).toContain("bg-surface px-4 py-2.5 text-sm font-bold text-brand-deep");
    expect(profile).toContain("bg-white px-4 text-sm font-black text-brand-deep");
  });

  it("raises secondary-copy contrast on dark Proffera surfaces and disabled primary actions", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain("--pf-on-brand-muted: #d9e3dd");
    expect(css).toContain('[class*="text-white/65"]');
    expect(css).toContain('[class*="text-white/70"]');
    expect(css).toContain("color: var(--pf-on-brand-muted) !important");
    expect(css).toContain("--pf-disabled-bg: #667168");
    expect(css).toContain("background: var(--pf-disabled-bg) !important");
  });

  it("keeps the directory refresh panel in document flow on mobile while preserving desktop access", () => {
    const layout = source("src/app/admin/foretag/directory/layout.tsx");
    const control = source("src/app/admin/foretag/directory/DirectoryLowConfidenceRefreshButton.tsx");

    expect(layout).toContain("mx-4 mb-6 lg:fixed lg:bottom-4 lg:right-4");
    expect(layout).not.toContain('className="fixed bottom-4 right-4');
    expect(control).toContain("refreshLowConfidenceDirectoryBatchAction");
    expect(control).toContain("BATCH_PAUSE_MS = 7_000");
    expect(control).toContain("RATE_LIMIT_BUFFER_MS = 2_000");
  });
});
