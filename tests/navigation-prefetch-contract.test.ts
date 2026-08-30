import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { navigationPrefetchPreferenceEnabled } from "../src/components/performance/navigation-prefetch-control";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("authenticated navigation prefetch contract", () => {
  it("defaults to disabled unless the current browser explicitly opts in", () => {
    expect(navigationPrefetchPreferenceEnabled(null)).toBe(false);
    expect(navigationPrefetchPreferenceEnabled("off")).toBe(false);
    expect(navigationPrefetchPreferenceEnabled("on")).toBe(true);

    const control = source("src/components/performance/navigation-prefetch-control.tsx");
    expect(control).toContain("() => false");
    expect(control).toContain("prefetch={enabled ? undefined : false}");
    expect(control).toContain("window.localStorage.setItem");
  });

  it("fails closed and still notifies links when saving the preference fails", () => {
    const control = source("src/components/performance/navigation-prefetch-control.tsx");

    expect(control).toContain("let forceNavigationPrefetchDisabled = false");
    expect(control).toContain("forceNavigationPrefetchDisabled = true;");
    expect(control).toContain("if (typeof window === \"undefined\" || forceNavigationPrefetchDisabled) return false;");
    expect(control).toContain("window.dispatchEvent(new Event(NAVIGATION_PREFETCH_CHANGE_EVENT));");
  });

  it("routes Dashboard and Platform Admin menu links through the browser preference", () => {
    const dashboard = source("src/components/dashboard/dashboard-shell.tsx");
    const admin = source("src/components/admin/admin-navigation.tsx");

    expect(dashboard).toContain("NavigationPrefetchLink");
    expect(dashboard).toContain("<NavigationPrefetchLink key={item.href}");
    expect(admin).toContain("<NavigationPrefetchControl />");
    expect(admin).toContain("<NavigationPrefetchLink key={item.area}");
  });
});
