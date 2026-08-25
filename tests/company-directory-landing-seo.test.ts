import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  query: "",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({
  getSql: vi.fn(() => async (strings: TemplateStringsArray) => {
    mocks.query = strings.join("?");
    return mocks.rows;
  }),
}));

import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";
import {
  DIRECTORY_LANDING_MIN_BUSINESSES,
  getDirectorySeoLanding,
  listDirectorySeoLandings,
  slugifyDirectoryLocation,
} from "@/lib/company-directory-landing-seo";

describe("Company Directory service-city SEO landings", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.query = "";
  });

  afterEach(() => {
    vi.doUnmock("@/lib/company-directory-landing-seo");
    vi.doUnmock("@/lib/company-directory-public-search");
    vi.doUnmock("react");
    vi.resetModules();
  });

  it("uses stable Swedish location slugs", () => {
    expect(slugifyDirectoryLocation("Södertälje")).toBe("sodertalje");
    expect(slugifyDirectoryLocation("Västra Frölunda")).toBe("vastra-frolunda");
  });

  it("discovers only rows returned by the quality-gated SQL contract", async () => {
    const service = DIRECTORY_SERVICES[0];
    mocks.rows = [
      {
        service_slug: service.slug,
        location_label: "Södertälje",
        business_count: DIRECTORY_LANDING_MIN_BUSINESSES,
      },
      {
        service_slug: "unknown-service",
        location_label: "Stockholm",
        business_count: 99,
      },
    ];

    await expect(listDirectorySeoLandings()).resolves.toEqual([
      {
        serviceSlug: service.slug,
        serviceLabel: service.label,
        location: "Södertälje",
        locationSlug: "sodertalje",
        businessCount: DIRECTORY_LANDING_MIN_BUSINESSES,
      },
    ]);

    expect(mocks.query).toContain("profile.publication_status = 'published'");
    expect(mocks.query).toContain("profile.is_active = true");
    expect(mocks.query).toContain("profile.privacy_blocked = false");
    expect(mocks.query).toContain("profile.claimed_workspace_id is null");
    expect(mocks.query).toContain("jsonb_array_length(coalesce(scb.workplaces, '[]'::jsonb)) = 1");
    expect(mocks.query).toContain("{visitingAddress,city}");
    expect(mocks.query).not.toContain("profile.municipality");
    expect(mocks.query).toContain("having count(distinct id) >=");
  });

  it("resolves a route landing and emits indexable metadata only for a qualifying row", async () => {
    const service = DIRECTORY_SERVICES[0];
    mocks.rows = [{
      service_slug: service.slug,
      location_label: "Södertälje",
      business_count: DIRECTORY_LANDING_MIN_BUSINESSES,
    }];

    await expect(getDirectorySeoLanding(service.slug, "sodertalje")).resolves.toMatchObject({
      serviceSlug: service.slug,
      location: "Södertälje",
      locationSlug: "sodertalje",
    });

    const page = await import("../src/app/hitta/[service]/[location]/page");
    const metadata = await page.generateMetadata({
      params: Promise.resolve({ service: service.slug, location: "sodertalje" }),
    });

    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates).toEqual({ canonical: `/hitta/${service.slug}/sodertalje` });

    mocks.rows = [];
    const missingMetadata = await page.generateMetadata({
      params: Promise.resolve({ service: service.slug, location: "stockholm" }),
    });
    expect(missingMetadata.robots).toEqual({ index: false, follow: true });
  });

  it("memoizes the shared landing lookup across metadata and page rendering", async () => {
    const service = DIRECTORY_SERVICES[0];
    const landing = {
      serviceSlug: service.slug,
      serviceLabel: service.label,
      location: "Södertälje",
      locationSlug: "sodertalje",
      businessCount: DIRECTORY_LANDING_MIN_BUSINESSES,
    };
    const landingLookup = vi.fn(async () => landing);
    const search = vi.fn(async () => ({
      query: { service: service.slug, location: "Södertälje", sort: "recommended" },
      results: [{ id: "profile-1" }],
      total: 1,
      limit: 30,
      offset: 0,
    }));

    vi.doMock("@/lib/company-directory-landing-seo", () => ({
      getDirectorySeoLanding: landingLookup,
    }));
    vi.doMock("@/lib/company-directory-public-search", () => ({
      searchPublishedCompanyDirectory: search,
    }));
    vi.doMock("react", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");
      return {
        ...actual,
        cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
          const memo = new Map<string, Result>();
          return (...args: Args) => {
            const key = JSON.stringify(args);
            if (!memo.has(key)) memo.set(key, fn(...args));
            return memo.get(key) as Result;
          };
        },
      };
    });

    vi.resetModules();
    const page = await import("../src/app/hitta/[service]/[location]/page");
    const params = Promise.resolve({ service: service.slug, location: "sodertalje" });

    await page.generateMetadata({ params });
    await page.default({ params });

    expect(landingLookup).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
  });
});
