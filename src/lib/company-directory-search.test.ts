import { describe, expect, it } from "vitest";

import { normalizeDirectoryLocationQuery } from "./company-directory-search";


describe("company directory search", () => {
  it("normalizes Swedish location input for exact city matching", () => {
    expect(normalizeDirectoryLocationQuery("  Stockholm  ")).toBe("stockholm");
    expect(normalizeDirectoryLocationQuery("SÖDERTÄLJE")).toBe("södertälje");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeDirectoryLocationQuery("Stockholms   stad")).toBe("stockholms stad");
  });
});
