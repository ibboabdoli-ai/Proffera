import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import {
  DIRECTORY_LANDING_MIN_BUSINESSES,
  getDirectorySeoLanding,
  listDirectorySeoLandings,
  slugifyDirectoryLocation,
} from "@/lib/company-directory-landing-seo";

describe("Company Directory service-city SEO landings", () => {
  beforeEach(() => mocks.getSql.mockReset());

  it("uses stable Swedish location slugs and a three-business quality floor", () => {
    expect(DIRECTORY_LANDING_MIN_BUSINESSES).toBe(3);
    expect(slugifyDirectoryLocation("Södertälje")).toBe("sodertalje");
    expect(slugifyDirectoryLocation("Västra Frölunda")).toBe("vastra-frolunda");
  });

  it("maps eligible query results into canonical landing records", async () => {
    const sql = vi.fn(async () => [
      { service_slug: "vvs", location_label: "Södertälje", business_count: 4 },
    ]);
    mocks.getSql.mockReturnValue(sql);

    expect(await listDirectorySeoLandings()).toEqual([
      {
        serviceSlug: "vvs",
        serviceLabel: "VVS / Rörmokare",
        location: "Södertälje",
        locationSlug: "sodertalje",
        businessCount: 4,
      },
    ]);
  });

  it("resolves only canonical service/location landing slugs", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => [
      { service_slug: "vvs", location_label: "Södertälje", business_count: 3 },
    ]));

    await expect(getDirectorySeoLanding("VVS", "sodertalje")).resolves.toMatchObject({
      serviceSlug: "vvs",
      locationSlug: "sodertalje",
    });
    await expect(getDirectorySeoLanding("vvs", "../sodertalje")).resolves.toBeNull();
    await expect(getDirectorySeoLanding("unknown-service", "sodertalje")).resolves.toBeNull();
  });

  it("returns no landings when the database boundary is unavailable", async () => {
    mocks.getSql.mockReturnValue(null);
    await expect(listDirectorySeoLandings()).resolves.toEqual([]);
  });
});
