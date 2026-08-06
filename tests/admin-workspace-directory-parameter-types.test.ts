import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("admin workspace directory SQL parameter typing", () => {
  it("casts nullable text filters before IS NULL and comparisons", () => {
    const code = source("src/lib/admin-workspace-directory.ts");

    expect(code).toContain("${searchPattern}::text is null");
    expect(code).toContain("w.name ilike ${searchPattern}::text");
    expect(code).toContain("w.slug ilike ${searchPattern}::text");
    expect(code).toContain("${planStatus}::text is null");
    expect(code).toContain("coalesce(p.status, 'none') = ${planStatus}::text");
  });

  it("casts the attention filter as boolean", () => {
    const code = source("src/lib/admin-workspace-directory.ts");

    expect(code).toContain("${attentionOnly}::boolean = false");
    expect(code).not.toContain("${searchPattern} is null");
    expect(code).not.toContain("${planStatus} is null");
  });
});
