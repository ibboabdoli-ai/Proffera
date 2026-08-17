import { describe, expect, it } from "vitest";

import {
  BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS,
  isBolagsverketVdmTestOrganizationNumber,
} from "./company-directory-bolagsverket-testdata";

describe("Bolagsverket VDM TEST identifiers", () => {
  it("includes the two organization numbers added in official testdata v1.01", () => {
    expect(isBolagsverketVdmTestOrganizationNumber("556282-0745")).toBe(true);
    expect(isBolagsverketVdmTestOrganizationNumber("5560986878")).toBe(true);
  });

  it("keeps the allowlist limited to 10-digit organization numbers", () => {
    expect(BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.every((value) => /^\d{10}$/.test(value))).toBe(true);
    expect(isBolagsverketVdmTestOrganizationNumber("198101032384")).toBe(false);
  });
});
