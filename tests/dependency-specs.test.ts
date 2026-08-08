import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const exactSemver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

describe("top-level dependency reproducibility", () => {
  it("uses exact versions instead of floating latest/range specs", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as PackageManifest;

    const specs = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    };

    expect(Object.keys(specs).length).toBeGreaterThan(0);

    for (const [name, version] of Object.entries(specs)) {
      expect(version, `${name} must use an exact version`).toMatch(exactSemver);
    }
  });
});
