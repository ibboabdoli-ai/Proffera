import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "e2e/tests/marketplace-preview-lifecycle.e2e.mjs"),
  "utf8",
);

const fixtureSource = readFileSync(
  path.join(process.cwd(), "src/app/api/e2e/marketplace/fixture/route.ts"),
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
    expect(source).toContain("test.setTimeout(4 * 60_000)");
  });

  it("uses full per-run customer identities so Preview dedupe cannot collide across runs", () => {
    expect(source).toContain("`marketplace-e2e-${id}@customer.example.invalid`");
    expect(source).toContain("function customerPhone(id)");
    expect(source).toContain("customerPhone(customerRunId)");
  });

  it("uses the exact per-run fixture coordinates for the browser quote instead of a shared hard-coded location", () => {
    expect(source).toContain("context.setGeolocation({ latitude: location.latitude, longitude: location.longitude })");
    expect(source).toContain("submitQuote(page, context, customerA, setup.body.location, 1)");
    expect(source).toContain("submitQuote(page, context, customerB, setup.body.location, 2)");
  });

  it("arms fixture cleanup immediately after successful setup and before metadata validation", () => {
    const setupOk = source.indexOf("expect(setup.body?.ok).toBe(true);");
    const cleanupArmed = source.indexOf("fixtureCreated = true;", setupOk);
    const isolationCheck = source.indexOf("expect(setup.body?.isolation).toEqual", setupOk);
    expect(setupOk).toBeGreaterThanOrEqual(0);
    expect(cleanupArmed).toBeGreaterThan(setupOk);
    expect(isolationCheck).toBeGreaterThan(cleanupArmed);
  });

  it("proves scoped cleanup and used/invalid token rejection", () => {
    expect(source).toContain("deleteProvider: false");
    expect(source).toContain("deleteProvider: true");
    expect(source).toContain("Omdömet har redan skickats");
    expect(source).toContain("Omdömeslänken är ogiltig");
    expect(source).toContain("providerExists).toBe(false)");
  });

  it("seeds Preview provider evidence before the guarded Ready-to-Published transition", () => {
    const profileInsert = fixtureSource.indexOf("insert into company_directory_profiles");
    const factsInsert = fixtureSource.indexOf("insert into company_directory_official_facts");
    const scbInsert = fixtureSource.indexOf("insert into company_directory_scb_enrichment");
    const publishUpdate = fixtureSource.indexOf("set publication_status = 'published'");

    expect(profileInsert).toBeGreaterThanOrEqual(0);
    expect(fixtureSource).toContain("'ready', 100, false, true, null");
    expect(factsInsert).toBeGreaterThan(profileInsert);
    expect(fixtureSource).toContain("source_payload_hash, last_synced_at");
    expect(scbInsert).toBeGreaterThan(factsInsert);
    expect(fixtureSource).toContain("'comparisonSnapshot', jsonb_build_object");
    expect(publishUpdate).toBeGreaterThan(scbInsert);
    expect(fixtureSource).toContain("and publication_status = 'ready'");
  });
});
