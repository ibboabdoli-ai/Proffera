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
});
