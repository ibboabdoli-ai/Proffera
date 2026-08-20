import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const pageSource = source("src/app/admin/foretag/directory/search-preview/page.tsx");
const nearbySource = source("src/app/admin/foretag/directory/search-preview/NearbySearchFields.tsx");

describe("admin directory nearby search contract", () => {
  it("clears a stale manual location when current position is selected", () => {
    expect(pageSource).toContain('id="directory-search-location"');
    expect(pageSource).toContain('locationInputId="directory-search-location"');
    expect(nearbySource).toContain("document.getElementById(locationInputId)");
    expect(nearbySource).toContain('locationInput.value = "";');
    expect(nearbySource).toContain("Platsfältet är rensat");
  });

  it("never applies manual city and nearby coordinates at the same time", () => {
    expect(pageSource).toContain("const hasManualLocation = rawLocation.trim().length > 0;");
    expect(pageSource).toContain('const latitude = hasManualLocation ? "" : rawLatitude;');
    expect(pageSource).toContain('const longitude = hasManualLocation ? "" : rawLongitude;');
    expect(pageSource).toContain('const location = hasManualLocation ? rawLocation : (nearbyParamsPresent ? "" : "Stockholm");');
  });
});
