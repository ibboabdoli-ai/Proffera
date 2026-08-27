import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parsePublicDirectoryNearbyValue,
  publicDirectoryNearbyCookieName,
  publicDirectoryNearbyCookiePath,
  serializePublicDirectoryNearbyValue,
} from "@/lib/public-directory-nearby";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public Directory Nearby privacy", () => {
  it("validates and normalizes private Nearby coordinates", () => {
    expect(parsePublicDirectoryNearbyValue("59.329323,18.068581")).toEqual({
      latitude: 59.329323,
      longitude: 18.068581,
    });
    expect(serializePublicDirectoryNearbyValue("59.3293234,18.0685806")).toBe("59.329323,18.068581");
    expect(parsePublicDirectoryNearbyValue("91,18")).toBeNull();
    expect(parsePublicDirectoryNearbyValue("59,181")).toBeNull();
    expect(parsePublicDirectoryNearbyValue("59")) .toBeNull();
  });

  it("keeps locale cookies HttpOnly and scoped to only the two public Directory routes", () => {
    expect(publicDirectoryNearbyCookieName("sv")).toBe("proffera_public_directory_nearby_sv");
    expect(publicDirectoryNearbyCookieName("en")).toBe("proffera_public_directory_nearby_en");
    expect(publicDirectoryNearbyCookiePath("sv")).toBe("/foretag/listad");
    expect(publicDirectoryNearbyCookiePath("en")).toBe("/en/companies");

    const actionSource = source("src/components/company-directory/public-directory-nearby-action.ts");
    expect(actionSource).toContain("httpOnly: true");
    expect(actionSource).toContain("sameSite: \"lax\"");
    expect(actionSource).toContain("PUBLIC_DIRECTORY_NEARBY_COOKIE_MAX_AGE_SECONDS = 300");
    expect(actionSource).toContain('new URLSearchParams({ nearby: "1", radius })');
  });

  it("never serializes exact customer coordinates into public Directory navigation URLs", () => {
    const formSource = source("src/components/company-directory/public-directory-search-form.tsx");
    const pageSource = source("src/components/company-directory/public-directory-search-page.tsx");
    const resultsSource = source("src/components/company-directory/public-directory-results.tsx");

    expect(formSource).toContain("searchPublicDirectoryNearbyAction(formData)");
    expect(formSource).toContain('params.set("nearby", "1")');
    expect(formSource).not.toContain('params.set("latitude"');
    expect(formSource).not.toContain('params.set("longitude"');
    expect(formSource).not.toContain("window.location.assign");

    expect(pageSource).toContain("await cookies()");
    expect(pageSource).toContain("publicDirectoryNearbyCookieName(locale)");
    expect(pageSource).toContain('firstParam(params?.nearby) === "1"');
    expect(resultsSource).not.toContain('"latitude"');
    expect(resultsSource).not.toContain('"longitude"');
    expect(resultsSource).toContain('url.searchParams.get("nearby") === "1"');
  });
});
