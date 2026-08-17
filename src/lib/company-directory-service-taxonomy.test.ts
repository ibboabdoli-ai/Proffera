import { describe, expect, it } from "vitest";

import { mapSniToDirectoryCategory } from "./company-directory-policy";
import {
  DIRECTORY_SERVICES,
  getDirectoryServiceDefinition,
  mapPrimarySniToDirectorySearchService,
  resolveDirectoryServiceQuery,
} from "./company-directory-service-taxonomy";

const supportedSniCodes = [
  "81.210",
  "81.221",
  "96.210",
  "49.420",
  "43.210",
  "43.221",
  "43.341",
  "43.320",
  "81.300",
];

describe("company directory service taxonomy", () => {
  it("contains every legacy SNI-derived service slug for compatibility", () => {
    for (const sniCode of supportedSniCodes) {
      const match = mapSniToDirectoryCategory(sniCode);
      expect(match).not.toBeNull();
      for (const serviceSlug of match?.serviceSlugs ?? []) {
        expect(getDirectoryServiceDefinition(serviceSlug)).not.toBeNull();
      }
    }
  });

  it("resolves common Swedish and English customer terms to stable services", () => {
    expect(resolveDirectoryServiceQuery("Rörmokare")).toEqual({
      kind: "service",
      serviceSlug: "vvs",
      categorySlug: "vvs",
    });
    expect(resolveDirectoryServiceQuery("elektriker")).toEqual({
      kind: "service",
      serviceSlug: "elinstallation",
      categorySlug: "elektriker",
    });
    expect(resolveDirectoryServiceQuery("städfirma")).toEqual({
      kind: "service",
      serviceSlug: "lokalvard",
      categorySlug: "stadning",
    });
    expect(resolveDirectoryServiceQuery("fönsterputs")).toEqual({
      kind: "service",
      serviceSlug: "fonsterputsning",
      categorySlug: "stadning",
    });
    expect(resolveDirectoryServiceQuery("frisör")).toEqual({
      kind: "service",
      serviceSlug: "frisor",
      categorySlug: "frisor",
    });
    expect(resolveDirectoryServiceQuery("barberare")).toEqual({
      kind: "service",
      serviceSlug: "frisor",
      categorySlug: "frisor",
    });
    expect(resolveDirectoryServiceQuery("hairdresser")).toEqual({
      kind: "service",
      serviceSlug: "frisor",
      categorySlug: "frisor",
    });
  });

  it("maps primary SNI to one broad defensible searchable service", () => {
    expect(mapPrimarySniToDirectorySearchService("81.210")).toBe("lokalvard");
    expect(mapPrimarySniToDirectorySearchService("81.221")).toBe("fonsterputsning");
    expect(mapPrimarySniToDirectorySearchService("96.910")).toBe("hemservice");
    expect(mapPrimarySniToDirectorySearchService("96.210")).toBe("frisor");
    expect(mapPrimarySniToDirectorySearchService("43.221")).toBe("vvs");
    expect(mapPrimarySniToDirectorySearchService("43.210")).toBe("elinstallation");
  });

  it("keeps fine-grained services available without inferring them from broad SNI", () => {
    expect(getDirectoryServiceDefinition("hemstadning")?.parentServiceSlug).toBe("lokalvard");
    expect(getDirectoryServiceDefinition("flyttstadning")?.parentServiceSlug).toBe("lokalvard");
    expect(getDirectoryServiceDefinition("vattenlacka")?.parentServiceSlug).toBe("vvs");
    expect(getDirectoryServiceDefinition("laddbox")?.parentServiceSlug).toBe("elinstallation");

    expect(mapPrimarySniToDirectorySearchService("81.210")).not.toBe("hemstadning");
    expect(mapPrimarySniToDirectorySearchService("81.210")).not.toBe("flyttstadning");
    expect(mapPrimarySniToDirectorySearchService("43.221")).not.toBe("vattenlacka");
    expect(mapPrimarySniToDirectorySearchService("43.210")).not.toBe("laddbox");
  });

  it("keeps service slugs unique", () => {
    const slugs = DIRECTORY_SERVICES.map((service) => service.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("returns null for unsupported search terms", () => {
    expect(resolveDirectoryServiceQuery("hundfrisör")).toBeNull();
    expect(mapPrimarySniToDirectorySearchService("62.100")).toBeNull();
  });
});