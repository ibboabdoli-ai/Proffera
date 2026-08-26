import { describe, expect, it } from "vitest";

import {
  collectBolagsverketApiErrors,
  formatBolagsverketApiErrors,
  isDeterministicBolagsverketOrganizationNotFound,
  resolveBolagsverketOrganizationRecord,
} from "./company-directory-official-facts-errors";

describe("collectBolagsverketApiErrors", () => {
  it("returns no errors for a healthy organisation response", () => {
    expect(collectBolagsverketApiErrors({
      organisationsidentitet: { identitetsbeteckning: "5560021361" },
      organisationsform: { kod: "AB", klartext: "Aktiebolag", dataproducent: "Bolagsverket" },
      juridiskForm: { kod: "49", klartext: "Övriga aktiebolag", dataproducent: "SCB" },
    })).toEqual([]);
  });

  it("detects a nested TIMEOUT returned with HTTP 200", () => {
    const errors = collectBolagsverketApiErrors({
      organisationsidentitet: { identitetsbeteckning: "5560021361" },
      juridiskForm: {
        fel: {
          typ: "TIMEOUT",
          felBeskrivning: "Uppgiftskällan svarade inte i tid.",
        },
        dataproducent: "SCB",
      },
    });

    expect(errors).toEqual([{
      path: "organisation.juridiskForm.fel",
      type: "TIMEOUT",
      description: "Uppgiftskällan svarade inte i tid.",
    }]);
  });

  it("detects unavailable source and organisation-not-found errors in separate datasets", () => {
    const errors = collectBolagsverketApiErrors({
      reklamsparr: {
        fel: { typ: "OTILLGANGLIG_UPPGIFTSKALLA", felBeskrivning: "SCB är inte tillgängligt." },
      },
      naringsgrenOrganisation: {
        fel: { typ: "ORGANISATION_FINNS_EJ", felBeskrivning: "Den efterfrågade informationen gick inte att hitta." },
      },
    });

    expect(errors.map((error) => error.type)).toEqual([
      "OTILLGANGLIG_UPPGIFTSKALLA",
      "ORGANISATION_FINNS_EJ",
    ]);
  });

  it("classifies only a non-empty all-ORGANISATION_FINNS_EJ error set as deterministic", () => {
    expect(isDeterministicBolagsverketOrganizationNotFound([])).toBe(false);

    expect(isDeterministicBolagsverketOrganizationNotFound([
      { path: "organisation.a.fel", type: "ORGANISATION_FINNS_EJ", description: "" },
      { path: "organisation.b.fel", type: " organisation_finns_ej ", description: "missing" },
    ])).toBe(true);

    expect(isDeterministicBolagsverketOrganizationNotFound([
      { path: "organisation.a.fel", type: "ORGANISATION_FINNS_EJ", description: "" },
      { path: "organisation.b.fel", type: "TIMEOUT", description: "temporary" },
    ])).toBe(false);
  });

  it("formats errors for sync diagnostics without exposing an unbounded payload", () => {
    const errors = collectBolagsverketApiErrors({
      organisationsform: { fel: { typ: "TIMEOUT" } },
      juridiskForm: { fel: { typ: "OTILLGANGLIG_UPPGIFTSKALLA" } },
    });

    expect(formatBolagsverketApiErrors(errors)).toBe(
      "organisation.organisationsform.fel: TIMEOUT; organisation.juridiskForm.fel: OTILLGANGLIG_UPPGIFTSKALLA",
    );
  });

  it("truncates unusually long upstream error fields and the final summary", () => {
    const errors = Array.from({ length: 8 }, (_, index) => ({
      path: `organisation.${"nested.".repeat(40)}fel${index}`,
      type: `TIMEOUT-${"X".repeat(200)}`,
      description: `upstream-${"Y".repeat(2_000)}`,
    }));

    const summary = formatBolagsverketApiErrors(errors);

    expect(summary.length).toBeLessThanOrEqual(1600);
    expect(summary).toContain("…");
    expect(summary).not.toContain("Y".repeat(300));
    expect(summary).not.toContain("fel5");
  });
});

describe("resolveBolagsverketOrganizationRecord", () => {
  const requested = "5561234567";

  it("accepts one exact record when the optional identity type is omitted", () => {
    const row = resolveBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: { identitetsbeteckning: requested },
        organisationsnamn: { organisationsnamnLista: [{ namn: "Testbolaget AB" }] },
      }],
    }, requested);

    expect(row.organisationsidentitet).toEqual({ identitetsbeteckning: requested });
  });

  it("accepts an explicit organization-number identity type", () => {
    const row = resolveBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: {
          identitetsbeteckning: requested,
          typ: "ORGANISATIONSNUMMER",
        },
      }],
    }, requested);

    expect(row).toBeTruthy();
  });

  it("rejects a record with no matching identity", () => {
    expect(() => resolveBolagsverketOrganizationRecord({
      organisationer: [{ organisationsidentitet: {} }],
    }, requested)).toThrow("no matching organization identity");
  });

  it("rejects a different returned organization number", () => {
    expect(() => resolveBolagsverketOrganizationRecord({
      organisationer: [{ organisationsidentitet: { identitetsbeteckning: "5567654321" } }],
    }, requested)).toThrow("no matching organization identity");
  });

  it("rejects multiple exact matches instead of selecting the first record", () => {
    expect(() => resolveBolagsverketOrganizationRecord({
      organisationer: [
        { organisationsidentitet: { identitetsbeteckning: requested } },
        { organisationsidentitet: { identitetsbeteckning: requested } },
      ],
    }, requested)).toThrow("multiple matching organization records");
  });

  it.each(["PERSONNUMMER", "SAMORDNINGSNUMMER", "GDNUMMER"])(
    "rejects explicit unsupported identity type %s",
    (typ) => {
      expect(() => resolveBolagsverketOrganizationRecord({
        organisationer: [{
          organisationsidentitet: { identitetsbeteckning: requested, typ },
        }],
      }, requested)).toThrow("unsupported identity type");
    },
  );

  it("rejects a malformed requested organization number", () => {
    expect(() => resolveBolagsverketOrganizationRecord({ organisationer: [] }, "123"))
      .toThrow("requires a 10-digit organization number");
  });
});
