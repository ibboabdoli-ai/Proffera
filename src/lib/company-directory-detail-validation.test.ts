import { describe, expect, it } from "vitest";

import { resolveCompleteBolagsverketOrganizationRecord } from "./company-directory-official-facts-errors";

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
});
