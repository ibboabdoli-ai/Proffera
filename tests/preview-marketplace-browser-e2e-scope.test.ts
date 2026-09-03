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
    expect(source).toContain("invitationCount === 1");
    expect(source).toContain("invitationCount).toBe(1)");
    expect(source).toContain("Skicka svar");
    expect(source).toContain("Välj denna offert");
    expect(source).toContain("Starta jobbet");
    expect(source).toContain("Markera slutfört");
    expect(source).toContain("Skicka verifierat omdöme");
    expect(source).toContain("jobCount).toBe(1)");
    expect(source).toContain("reviewCount).toBe(1)");
    expect(source).toContain("expect(latest?.originalRecipientObserved).toBe(false)");
    expect(source).toContain("test.setTimeout(5 * 60_000)");
  });

  it("uses full per-run customer identities so Preview dedupe cannot collide across runs", () => {
    expect(source).toContain("`marketplace-e2e-${id}@customer.example.invalid`");
    expect(source).toContain("function customerPhone(id)");
    expect(source).toContain("customerPhone(customerRunId)");
    expect(source).not.toContain("id.slice(0, 24)");
    expect(source).not.toContain("`07000000${ordinal}1`");
  });

  it("keeps the browser quote at the same remote synthetic coordinates as the fixture", () => {
    expect(source).toContain("latitude: -80");
    expect(source).toContain("longitude: 170");
  });

  it("proves scoped cleanup and used/invalid token rejection", () => {
    expect(source).toContain("deleteProvider: false");
    expect(source).toContain("deleteProvider: true");
    expect(source).toContain("Omdömet har redan skickats");
    expect(source).toContain("Omdömeslänken är ogiltig");
    expect(source).toContain("providerExists).toBe(false)");
  });
});
