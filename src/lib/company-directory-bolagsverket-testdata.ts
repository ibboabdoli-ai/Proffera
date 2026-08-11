import "server-only";

// Official Bolagsverket TEST/accept2 identifiers from
// "Testdata API Värdefulla datamängder" supplied for /organisationer testing.
// Keep this list limited to documented TEST identifiers; never guess organisation numbers.
export const BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS = [
  "5560021361",
  "9124001992",
  "7164099017",
  "7020008350",
  "5164050253",
  "5560000002",
  "5560004755",
  "5560038860",
  "5560047473",
  "5560065087",
  "5560068255",
  "5560069618",
  "5560085119",
  "5560107053",
  "5560125006",
  "5560127093",
  "5560130717",
  "5560134123",
  "5567575872",
  "7020011628",
  "7020015538",
  "7140000001",
  "7140001111",
  "7164019478",
  "7164034089",
  "7164040292",
  "7164043601",
  "7164074200",
  "7696154462",
  "8023647822",
  "8025252027",
  "9020000999",
  "9020025012",
  "9020037603",
  "9140001042",
  "9140001398",
  "9144002897",
  "9152002656",
  "9160000001",
  "9164005002",
  "9164012354",
  "9164012719",
  "9697173434",
  "9697174515",
  "9697258623",
  "9697400522",
] as const;

const allowed = new Set<string>(BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS);

export function isBolagsverketVdmTestOrganizationNumber(value: string) {
  return allowed.has(value.replace(/\D/g, ""));
}
