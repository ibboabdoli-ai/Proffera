import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformAdmin: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({
  getPlatformAdmin: mocks.getPlatformAdmin,
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import {
  DIRECTORY_PROVIDER_GEOCODING_MAX_BATCH,
  geocodeDirectoryProviderPointsFromAdmin,
  getDirectoryGeocodingStatus,
} from "@/lib/company-directory-geocoding";

const correctedNoMatch = "lantmateriet_no_match_v4_2:registerenhet_v2:scb_workplace:no_reference";
const workplace = [{
  municipality: "Södertälje",
  visitingAddress: {
    addressLine: "Nya vägen 2",
    postalCode: "151 00",
    city: "Södertälje",
  },
}];

function queryText(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function statusRow(overrides: Record<string, unknown> = {}) {
  return {
    organization_number: "5560000000",
    address_line1: "Registrerad väg 1",
    postal_code: "111 11",
    city: "Stockholm",
    municipality: "Stockholm",
    latitude: null,
    longitude: null,
    geocode_source: null,
    scb_workplaces: workplace,
    scb_conflicts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.getPlatformAdmin.mockReset();
  mocks.getSql.mockReset();
  mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin" });
  process.env.COMPANY_DIRECTORY_GEOCODING_ENABLED = "true";
  process.env.LANTMATERIET_ADDRESS_API_USERNAME = "test-user";
  process.env.LANTMATERIET_ADDRESS_API_PASSWORD = "test-password";
  process.env.LANTMATERIET_ADDRESS_API_BASE_URL =
    "https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2";
});

describe("bounded provider-point geocoding", () => {
  it("reports the provider-wide queue without treating profiles lacking a canonical workplace as runnable", async () => {
    const queries: string[] = [];
    const rows = [
      statusRow({ latitude: 59.1955, longitude: 17.6253 }),
      statusRow({ organization_number: "5560000001" }),
      statusRow({ organization_number: "5560000002", geocode_source: correctedNoMatch }),
      statusRow({ organization_number: "5560000003", scb_workplaces: [] }),
    ];
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      queries.push(query);
      if (query.includes("pg_extension")) return [{ ready: true }];
      if (query.includes("from company_directory_profiles profile")) return rows;
      throw new Error(`Unexpected SQL: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    const status = await getDirectoryGeocodingStatus();

    expect(status).toMatchObject({
      providerTotal: 4,
      geocoded: 1,
      remaining: 1,
      needsReview: 1,
      unavailable: 1,
    });
    const queueQuery = queries.find((query) => query.includes("from company_directory_profiles profile")) ?? "";
    expect(queueQuery).toContain("profile.publication_status = 'published'");
    expect(queueQuery).toContain("profile.organization_kind = 'juridical_person'");
    expect(queueQuery).toContain("relation.is_active = true");
    expect(queueQuery).toContain("relation.public_visible = true");
    expect(queueQuery).not.toContain("profile.organization_number in");
  });

  it("keeps the write path super-admin-only, provider-wide, missing-coordinate-only, and hard-capped at three", async () => {
    const queries: string[] = [];
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      queries.push(query);
      if (query.includes("pg_extension")) return [{ ready: true }];
      if (query.includes("profile.id::text")) return [];
      if (query.includes("from company_directory_profiles profile")) return [];
      throw new Error(`Unexpected SQL: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await geocodeDirectoryProviderPointsFromAdmin(99);

    expect(DIRECTORY_PROVIDER_GEOCODING_MAX_BATCH).toBe(3);
    expect(mocks.getPlatformAdmin).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      attempted: 0,
      geocoded: 0,
      noMatch: 0,
      errors: 0,
      remaining: 0,
      needsReview: 0,
    });
    const targetQuery = queries.find((query) => query.includes("profile.id::text")) ?? "";
    expect(targetQuery).toContain("profile.publication_status = 'published'");
    expect(targetQuery).toContain("profile.is_active = true");
    expect(targetQuery).toContain("profile.privacy_blocked = false");
    expect(targetQuery).toContain("profile.organization_kind = 'juridical_person'");
    expect(targetQuery).toContain("relation.is_active = true");
    expect(targetQuery).toContain("relation.public_visible = true");
    expect(targetQuery).toContain("location.latitude is null or location.longitude is null");
    expect(targetQuery).not.toContain("profile.organization_number in");
  });
});
