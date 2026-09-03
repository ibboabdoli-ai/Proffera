import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "e2e/tests/marketplace-preview-lifecycle.e2e.mjs"),
  "utf8",
);

describe("Marketplace Preview browser E2E scope", () => {
  it("covers the full customer-provider-review lifecycle and isolation assertions", () => {
    expect(source).toContain("Skicka förfrågan");
    expect(source).toContain('"PUT", fixturePath');
    expect(source).toContain("Skicka svar");
    expect(source).toContain("Välj denna offert");
    expect(source).toContain("Starta jobbet");
    expect(source).toContain("Markera slutfört");
    expect(source).toContain("Skicka verifierat omdöme");
    expect(source).toContain("jobCount).toBe(1)");
    expect(source).toContain("reviewCount).toBe(1)");
    expect(source).toContain("expect(latest?.originalRecipientObserved).toBe(false)");
  });

  it("proves scoped cleanup and used/invalid token rejection", () => {
    expect(source).toContain("deleteProvider: false");
    expect(source).toContain("deleteProvider: true");
    expect(source).toContain("Omdömet har redan skickats");
    expect(source).toContain("Omdömeslänken är ogiltig");
    expect(source).toContain("providerExists).toBe(false)");
  });
});
