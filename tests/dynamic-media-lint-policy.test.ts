import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dynamic workspace media lint policy", () => {
  it("limits direct image rendering to the three dynamic media surfaces", () => {
    const config = source("eslint.config.mjs");
    const scopedBlock = config.slice(
      config.indexOf("Workspace media URLs may use"),
      config.indexOf("globalIgnores"),
    );

    expect(scopedBlock).toContain('"src/app/demo/primeview/gallery/page.tsx"');
    expect(scopedBlock).toContain('"src/app/dashboard/galleri/page.tsx"');
    expect(scopedBlock).toContain('"src/app/boka/*/page.tsx"');
    expect(scopedBlock).toContain('"@next/next/no-img-element": "off"');
    expect(scopedBlock).toContain("original image dimensions are not stored");
    expect(scopedBlock).not.toContain('"src/**"');
    expect(scopedBlock).not.toContain('"**/*.tsx"');
  });
});
