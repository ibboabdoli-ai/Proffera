import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("analytics consent responsive UI", () => {
  it("keeps the consent prompt compact on desktop and mobile", () => {
    const control = source("src/components/analytics/analytics-consent-control.tsx");

    expect(control).toContain("max-w-md");
    expect(control).toContain("max-h-[calc(100dvh-1rem)]");
    expect(control).toContain("overflow-y-auto");
    expect(control).toContain("grid grid-cols-2 gap-2");
    expect(control).toContain("p-3");
    expect(control).toContain("sm:p-4");
    expect(control).not.toContain("max-w-2xl");
    expect(control).not.toContain("flex flex-col gap-2 sm:flex-row");
  });

  it("preserves full-size touch targets while reducing visual bulk", () => {
    const control = source("src/components/analytics/analytics-consent-control.tsx");

    expect(control).toContain("min-h-11");
    expect(control).toContain("text-[13px]");
    expect(control).toContain("rounded-lg");
  });
});
