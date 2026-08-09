import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketing route aliases", () => {
  it("keeps the Swedish Funktioner alias working", () => {
    const page = source("src/app/funktioner/page.tsx");
    expect(page).toContain('permanentRedirect("/tjanster")');
  });

  it("keeps the English Features alias working", () => {
    const page = source("src/app/en/features/page.tsx");
    expect(page).toContain('permanentRedirect("/en/services")');
  });
});
