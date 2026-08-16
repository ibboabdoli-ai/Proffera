import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migratedMarketingHex = /#(?:f6f8f4|e1e7df|dfe5dd|17452f|17201a|5b665f|102a1c|eef5ef)/i;

describe("Proffera Design System 2.0 foundation", () => {
  it("exposes semantic Tailwind theme tokens from one CSS source of truth", () => {
    const globals = source("src/app/globals.css");

    expect(globals).toContain("@theme inline");
    expect(globals).toContain("--color-canvas: var(--pf-canvas)");
    expect(globals).toContain("--color-brand: var(--pf-brand)");
    expect(globals).toContain("--color-ink: var(--pf-ink)");
    expect(globals).toContain("--color-line: var(--pf-line)");
    expect(globals).toContain("--radius-control: var(--pf-radius-control)");
    expect(globals).toContain("--radius-card: var(--pf-radius-card)");
    expect(globals).toContain("--shadow-card: var(--pf-shadow-card)");
  });

  it("uses semantic tokens in the shared marketing CTA", () => {
    const button = source("src/components/ui/button-link.tsx");

    expect(button).toContain("rounded-control");
    expect(button).toContain("bg-brand");
    expect(button).toContain("hover:bg-brand-hover");
    expect(button).toContain("bg-surface");
    expect(button).not.toMatch(migratedMarketingHex);
  });

  it("uses the same semantic palette across service and industry templates", () => {
    for (const path of [
      "src/components/marketing/marketing-service-detail.tsx",
      "src/components/marketing/marketing-industry-detail.tsx",
    ]) {
      const template = source(path);
      expect(template).toContain("bg-canvas");
      expect(template).toContain("text-ink");
      expect(template).toContain("text-ink-muted");
      expect(template).toContain("border-line");
      expect(template).toContain("rounded-card");
      expect(template).toContain("rounded-panel");
      expect(template).not.toMatch(migratedMarketingHex);
    }
  });
});
