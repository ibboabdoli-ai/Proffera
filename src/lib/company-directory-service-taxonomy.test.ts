import { describe, expect, it } from "vitest";

import { mapSniToDirectoryCategory } from "./company-directory-policy";
import {
  DIRECTORY_SERVICES,
  getDirectoryServiceDefinition,
  resolveDirectoryServiceQuery,
} from "./company-directory-service-taxonomy";

const supportedSniCodes = [
  "81.210",
  "81.221",
  "49.420",
  "43.210",
  "43.221",
  "43.341",
  "43.320",
  "81.300",
];

describe("company directory service taxonomy", () => {
  it("contains every legacy SNI-derived service slug", () => {
    for (const sniCode of supportedSniCodes) {
      const match = mapSniToDirectoryCategory(sniCode);
      expect(match).not.toBeNull();
      for (const serviceSlug of match?.serviceSlugs ?? []) {
        expect(getDirectoryServiceDefinition(serviceSlug)).not.toBeNull();
      }
    }
  });

  it("resolves common Swedish customer terms to stable services", () => {
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
    expect(resolveDirectoryServiceQuery("fönsterputs")).toEqual({
      kind: "service",
      serviceSlug: "fonsterputsning",
      categorySlug: "stadning",
    });
  });

  it("supports fine-grained services without assigning them from broad SNI data", () => {
    expect(getDirectoryServiceDefinition("vattenlacka")?.parentServiceSlug).toBe("vvs");
    expect(getDirectoryServiceDefinition("laddbox")?.parentServiceSlug).toBe("elinstallation");

    expect(mapSniToDirectoryCategory("43.221")?.serviceSlugs).toEqual(["vvs"]);
    expect(mapSniToDirectoryCategory("43.210")?.serviceSlugs).toEqual(["elinstallation"]);
  });

  it("keeps service slugs unique", () => {
    const slugs = DIRECTORY_SERVICES.map((service) => service.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("returns null for unsupported search terms", () => {
    expect(resolveDirectoryServiceQuery("hundfrisör")).toBeNull();
  });
});
