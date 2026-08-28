import { describe, expect, it } from "vitest";

import { extractOfficialFacts } from "@/lib/company-directory-official-facts";

describe("Bolagsverket official facts parser", () => {
  it("accepts the procedure alias and timestamp-shaped fromDatum used by the API example", () => {
    const facts = extractOfficialFacts({
      pagandeAvvecklingsEllerOmstruktureringsforfarande: {
        dataproducent: "Bolagsverket",
        pagandeAvvecklingsEllerOmstruktureringsforfarandeLista: [{
          kod: "KONKURS",
          klartext: "Konkurs inledd",
          fromDatum: "2026-08-19T14:30:00Z",
        }],
      },
    });

    expect(facts.ongoingProcedures).toEqual([{
      code: "KONKURS",
      label: "Konkurs inledd",
      fromDate: "2026-08-19",
    }]);
    expect(facts.dataProducers.pagaendeAvvecklingsEllerOmstruktureringsforfarande).toBe("Bolagsverket");
  });

  it("keeps supporting the schema spelling and date-only values", () => {
    const facts = extractOfficialFacts({
      pagaendeAvvecklingsEllerOmstruktureringsforfarande: {
        pagaendeAvvecklingsEllerOmstruktureringsforfarandeLista: {
          kod: "REKONSTRUKTION",
          klartext: "Företagsrekonstruktion",
          fromDatum: "2026-08-20",
        },
      },
    });

    expect(facts.ongoingProcedures[0]?.fromDate).toBe("2026-08-20");
  });

  it("accepts a whitespace-separated timestamp", () => {
    const facts = extractOfficialFacts({
      pagaendeAvvecklingsEllerOmstruktureringsforfarande: {
        pagaendeAvvecklingsEllerOmstruktureringsforfarandeLista: {
          kod: "REKONSTRUKTION",
          fromDatum: "2026-08-20 14:30:00Z",
        },
      },
    });

    expect(facts.ongoingProcedures[0]?.fromDate).toBe("2026-08-20");
  });

  it("rejects malformed timestamp suffixes instead of recording their date prefix", () => {
    const facts = extractOfficialFacts({
      pagaendeAvvecklingsEllerOmstruktureringsforfarande: {
        pagaendeAvvecklingsEllerOmstruktureringsforfarandeLista: [
          { kod: "INVALID_T", fromDatum: "2026-08-20Tinvalid" },
          { kod: "INVALID_SPACE", fromDatum: "2026-08-20 garbage" },
          { kod: "INVALID_CALENDAR_DATE", fromDatum: "2026-02-29" },
        ],
      },
    });

    expect(facts.ongoingProcedures.map((procedure) => procedure.fromDate)).toEqual(["", "", ""]);
  });

  it("maps explicit reklamspärr JA and NEJ without changing their meaning", () => {
    expect(extractOfficialFacts({ reklamsparr: { kod: "JA" } }).advertisingBlocked).toBe(true);
    expect(extractOfficialFacts({ reklamsparr: { kod: "NEJ" } }).advertisingBlocked).toBe(false);
  });

  it("keeps an explicit reklamspärr code unknown when its dataset carries an error", () => {
    const facts = extractOfficialFacts({
      reklamsparr: {
        kod: "NEJ",
        fel: { typ: "OVANTAT_FEL" },
      },
    });

    expect(facts.advertisingBlocked).toBeNull();
  });

  it("maps documented null reklamspärr to no block only with a successful Bolagsverket post address", () => {
    const facts = extractOfficialFacts({
      reklamsparr: null,
      postadressOrganisation: {
        dataproducent: "Bolagsverket",
        fel: null,
        postadress: {
          utdelningsadress: "Testgatan 1",
          postnummer: "11111",
          postort: "STOCKHOLM",
          land: "Sverige",
        },
      },
    });

    expect(facts.advertisingBlocked).toBe(false);
  });

  it("keeps null reklamspärr unknown when the documented post-address condition is not met", () => {
    expect(extractOfficialFacts({ reklamsparr: null }).advertisingBlocked).toBeNull();
    expect(extractOfficialFacts({
      reklamsparr: null,
      postadressOrganisation: { postadress: null },
    }).advertisingBlocked).toBeNull();
    expect(extractOfficialFacts({
      reklamsparr: null,
      postadressOrganisation: {
        dataproducent: "SCB",
        fel: null,
        postadress: { land: "Sverige" },
      },
    }).advertisingBlocked).toBeNull();
    expect(extractOfficialFacts({
      reklamsparr: null,
      postadressOrganisation: {
        dataproducent: "Bolagsverket",
        fel: { typ: "OTILLGANGLIG_UPPGIFTSKALLA" },
        postadress: { land: "Sverige" },
      },
    }).advertisingBlocked).toBeNull();
  });

  it("keeps malformed or unknown reklamspärr codes fail-closed", () => {
    expect(extractOfficialFacts({ reklamsparr: { kod: "KANSKE" } }).advertisingBlocked).toBeNull();
    expect(extractOfficialFacts({ reklamsparr: {} }).advertisingBlocked).toBeNull();
    expect(extractOfficialFacts({}).advertisingBlocked).toBeNull();
  });
});
