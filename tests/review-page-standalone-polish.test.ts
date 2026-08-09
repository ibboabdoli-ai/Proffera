import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("verified review page standalone polish", () => {
  it("keeps verified review routes outside the public site shell", () => {
    const code = source("src/components/layout/app-shell.tsx");

    expect(code).toContain('pathname?.startsWith("/review/")');
  });

  it("keeps the anti-spam website field without exposing a Website label in page content", () => {
    const code = source("src/app/review/[token]/verified-review-form.tsx");

    expect(code).toContain('name="website"');
    expect(code).toContain('aria-hidden="true"');
    expect(code).not.toContain("Website\n");
    expect(code).not.toContain(">Website<");
  });
});
