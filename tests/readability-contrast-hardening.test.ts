import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Readability and contrast hardening", () => {
  it("publishes the semantic color aliases used by public directory and workspace UI", () => {
    const css = source("src/app/globals.css");

    expect(css).toContain("--pf-body: #4f6178");
    expect(css).toContain("--pf-ink-muted: #617085");
    expect(css).toContain("--color-body: var(--pf-body)");
    expect(css).toContain("--color-muted: var(--pf-ink-muted)");
    expect(css).toContain("--color-brand-strong: var(--pf-brand-hover)");
    expect(css).toContain("--shadow-panel: var(--pf-shadow-lift)");
  });

  it("keeps dark blue public CTAs readable when global anchor inheritance wins over utility layers", () => {
    const css = source("src/app/globals.css");
    const header = source("src/components/layout/header.tsx");

    expect(css).toContain('[class~="bg-[#0a2e63]"]');
    expect(css).toContain('[class~="bg-[#0a3c8f]"]');
    expect(css).toContain('[class~="bg-[#1469d8]"]');
    expect(css).toContain('[class~="bg-[#1769c2]"]');
    expect(css).toContain('[class~="bg-[#2f80ed]"]');
    expect(header).toContain('bg-[#0a2e63] px-4 text-sm font-black !text-white');
    expect(header).toContain("hover:!text-white");
  });

  it("forces accessible white labels on Maria mauve CTA buttons and links, including iOS WebKit", () => {
    const css = source("src/app/globals.css");
    const demo = source("public/demo/makeup-by-maria-v2.html");
    const maria = source("src/app/dashboard/maria/page.tsx");
    const calendar = source("src/app/dashboard/maria/kalender/maria-calendar-confirm-button.tsx");

    // Check the white-fill rule itself, not the disabled-button selector below it.
    const whiteRule = css.match(
      /:where\(a, button\)\[class\*="bg-slate-950"\][\s\S]*?\{\s*color: #ffffff !important;\s*-webkit-text-fill-color: #ffffff !important;\s*\}/,
    )?.[0] ?? "";
    expect(whiteRule).not.toBe("");
    for (const color of ["#845363", "#6d3e4e"]) {
      expect(whiteRule).toContain('[class~="bg-[' + color + ']"]');
    }
    // Both real demo actions must retain their own accessible WebKit text fill.
    // An assertion on the entire HTML could pass if only ONE rule survives.
    for (const selector of [".booking-complete a", ".confirm"]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const declaration = demo.match(new RegExp(escaped + "\\s*\\{[^}]*\\}"))?.[0] ?? "";
      expect(declaration, selector).not.toBe("");
      expect(declaration, selector).toContain("background:var(--rose);color:#fff;-webkit-text-fill-color:#fff");
    }
    expect(maria).toContain("bg-[#845363]");
    expect(calendar).toContain("bg-[#845363]");
    // Do not force white on Maria's light secondary buttons.
    expect(calendar).toContain('kind === "close"');
    expect(calendar).toContain("bg-white");
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

    expect(css).toContain("--pf-on-brand-muted: #dce8f7");
    expect(css).toContain('[class*="text-white/65"]');
    expect(css).toContain('[class*="text-white/70"]');
    expect(css).toContain("color: var(--pf-on-brand-muted) !important");
    expect(css).toContain("--pf-disabled-bg: #7c8ca1");
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
