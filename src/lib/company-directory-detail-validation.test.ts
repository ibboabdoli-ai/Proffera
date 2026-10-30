import { describe, expect, it } from "vitest";

import { resolveCompleteBolagsverketOrganizationRecord } from "./company-directory-detail-validation";
import { BolagsverketOrganizationNotFoundError } from "./company-directory-official-facts-errors";

describe("complete Bolagsverket detail validation", () => {
  const requested = "5561234567";

  it("fails closed on a nested partial-response error", () => {
    expect(() => resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: { identitetsbeteckning: requested },
        juridiskForm: { fel: { typ: "TIMEOUT", felBeskrivning: "upstream timeout" } },
      }],
    }, requested)).toThrow("incomplete data");
  });

  it("classifies an all-not-found response as a typed deterministic failure", () => {
    expect(() => resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: { identitetsbeteckning: requested },
        juridiskForm: { fel: { typ: "ORGANISATION_FINNS_EJ" } },
        organisationsform: { fel: { typ: "ORGANISATION_FINNS_EJ" } },
      }],
    }, requested)).toThrow(BolagsverketOrganizationNotFoundError);
  });

  it("retains generic handling when a not-found response includes a transient error", () => {
    const verify = () => resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: { identitetsbeteckning: requested },
        juridiskForm: { fel: { typ: "ORGANISATION_FINNS_EJ" } },
        organisationsform: { fel: { typ: "TIMEOUT" } },
      }],
    }, requested);
    expect(verify).toThrow("incomplete data");
    expect(verify).not.toThrow(BolagsverketOrganizationNotFoundError);
  });

  it("selects the exact organization instead of the first returned record", () => {
    const row = resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [
        { organisationsidentitet: { identitetsbeteckning: "5567654321" } },
        { organisationsidentitet: { identitetsbeteckning: requested } },
      ],
    }, requested);

    expect(row.organisationsidentitet).toEqual({ identitetsbeteckning: requested });
  });

  it("rejects ambiguous exact matches", () => {
    expect(() => resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [
        { organisationsidentitet: { identitetsbeteckning: requested } },
        { organisationsidentitet: { identitetsbeteckning: requested } },
      ],
    }, requested)).toThrow("multiple matching organization records");
  });

  it("rejects an explicit non-organization identity type", () => {
    expect(() => resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: {
          identitetsbeteckning: requested,
          typ: "PERSONNUMMER",
        },
      }],
    }, requested)).toThrow("unsupported identity type");
  });

  it("rejects the documented PERSONNR identity code inside a type object", () => {
    expect(() => resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: {
          identitetsbeteckning: requested,
          typ: { kod: "PERSONNR", klartext: "Personnummer" },
        },
      }],
    }, requested)).toThrow("unsupported identity type");
  });

  it("accepts the documented ORGNR identity code inside a type object", () => {
    const row = resolveCompleteBolagsverketOrganizationRecord({
      organisationer: [{
        organisationsidentitet: {
          identitetsbeteckning: requested,
          typ: { kod: "ORGNR", klartext: "Organisationsnummer" },
        },
      }],
    }, requested);

    expect(row.organisationsidentitet).toEqual({
      identitetsbeteckning: requested,
      typ: { kod: "ORGNR", klartext: "Organisationsnummer" },
    });
  });
});
