import { describe, expect, it } from "vitest";

import {
  normalizeSwedishCompanyIdentityName,
  swedishCompanyNamesEquivalent,
} from "./company-directory-company-name";

describe("Swedish company-name identity normalization", () => {
  it("treats AB and Aktiebolag as the same legal suffix", () => {
    expect(swedishCompanyNamesEquivalent(
      "Thomas Lundins Måleri & Fastighetsservice Aktiebolag",
      "THOMAS LUNDINS MÅLERI & FASTIGHETSSERVICE AB",
    )).toBe(true);
  });

  it("also normalizes Aktiebolaget without hiding real name changes", () => {
    expect(swedishCompanyNamesEquivalent("Exempel Aktiebolaget", "Exempel AB")).toBe(true);
    expect(swedishCompanyNamesEquivalent("Gamla Namnet AB", "Nya Namnet AB")).toBe(false);
  });

  it("normalizes spacing, punctuation and Unicode consistently", () => {
    expect(normalizeSwedishCompanyIdentityName("  Å & Ö AB  ")).toBe(
      normalizeSwedishCompanyIdentityName("Å-Ö Aktiebolag"),
    );
  });

  it("preserves word boundaries so distinct names cannot collapse together", () => {
    expect(normalizeSwedishCompanyIdentityName("A B AB")).toBe("a b ab");
    expect(normalizeSwedishCompanyIdentityName("AB AB")).toBe("ab ab");
    expect(swedishCompanyNamesEquivalent("A B AB", "AB AB")).toBe(false);
  });

  it("requires Unicode-aware boundaries around the Aktiebolag suffix", () => {
    expect(swedishCompanyNamesEquivalent("ÅAktiebolag", "Å AB")).toBe(false);
    expect(swedishCompanyNamesEquivalent("ÄAktiebolaget", "Ä AB")).toBe(false);
    expect(swedishCompanyNamesEquivalent("ÖAktiebolag", "Ö AB")).toBe(false);
    expect(swedishCompanyNamesEquivalent("Å Aktiebolag", "Å AB")).toBe(true);
  });
});
