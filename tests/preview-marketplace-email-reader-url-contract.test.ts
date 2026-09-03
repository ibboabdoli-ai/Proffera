import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/app/api/e2e/marketplace/email/route.ts"),
  "utf8",
);

describe("Preview Marketplace email reader URL confinement", () => {
  it("requires the current Vercel Preview origin and an allowlisted lifecycle path", () => {
    expect(source).toContain('/^[a-z0-9.-]+\\.vercel\\.app$/');
    expect(source).toContain("if (url.origin !== origin) continue");
    expect(source).toContain("if (!url.pathname.startsWith(pathByKind[kind])) continue");
  });
});
