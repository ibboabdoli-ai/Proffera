import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformAdmin: vi.fn(),
  getSql: vi.fn(),
  requireSuperAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({
  getPlatformAdmin: mocks.getPlatformAdmin,
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/admin-authorization", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));

import {
  DIRECTORY_PROVIDER_GEOCODING_MAX_BATCH,
  geocodeDirectoryProviderPointsFromAdmin,
  getDirectoryGeocodingStatus,
} from "@/lib/company-directory-geocoding";

const correctedNoMatch = "lantmateriet_no_match_v4_2:registerenhet_v2:scb_workplace:no_reference";
const transientError = "lantmateriet_transient_error_v4_2";
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
    id: "11111111-1111-4111-8111-111111111111",
    organization_number: "5560000000",
    display_name: "Verifierad Leverantör AB",
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
  mocks.requireSuperAdmin.mockReset();
  mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin" });
  mocks.requireSuperAdmin.mockResolvedValue({ role: "super_admin" });
  process.env.COMPANY_DIRECTORY_GEOCODING_ENABLED = "true";
  process.env.LANTMATERIET_ADDRESS_API_USERNAME = "test-user";
  process.env.LANTMATERIET_ADDRESS_API_PASSWORD = "test-password";
  process.env.LANTMATERIET_ADDRESS_API_BASE_URL =
    "https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2";
});

describe("bounded provider-point geocoding", () => {
  it("reports provider-wide status through a database aggregate while preserving queue semantics", async () => {
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
      if (query.includes("with provider_state as")) return rows;
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
    const statusQuery = queries.find((query) => query.includes("with provider_state as")) ?? "";
    expect(statusQuery).toContain("count(*) filter");
    expect(statusQuery).toContain("profile.publication_status = 'published'");
    expect(statusQuery).toContain("profile.organization_kind = 'juridical_person'");
    expect(statusQuery).toContain("relation.is_active = true");
    expect(statusQuery).toContain("relation.public_visible = true");
    expect(statusQuery).toContain("jsonb_typeof(scb.workplaces)");
    expect(statusQuery).not.toContain("profile.organization_number in");
  });

  it("keeps the write path super-admin-only, DB-bounded, provider-wide, and hard-capped at three", async () => {
    const calls: Array<{ query: string; values: unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = queryText(strings);
      calls.push({ query, values });
      if (query.includes("pg_extension")) return [{ ready: true }];
      if (query.includes("profile.id::text")) return [];
      if (query.includes("with provider_state as")) {
        return [{ total: 0, geocoded: 0, remaining: 0, needs_review: 0, unavailable: 0 }];
      }
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
    const target = calls.find((call) => call.query.includes("profile.id::text"));
    expect(target?.query).toContain("profile.publication_status = 'published'");
    expect(target?.query).toContain("profile.is_active = true");
    expect(target?.query).toContain("profile.privacy_blocked = false");
    expect(target?.query).toContain("profile.organization_kind = 'juridical_person'");
    expect(target?.query).toContain("relation.is_active = true");
    expect(target?.query).toContain("relation.public_visible = true");
    expect(target?.query).toContain("location.latitude is null or location.longitude is null");
    expect(target?.query).toContain("jsonb_typeof(scb.workplaces)");
    expect(target?.query).toContain("limit ?");
    expect(target?.values).toContain(DIRECTORY_PROVIDER_GEOCODING_MAX_BATCH);
    expect(target?.query).not.toContain("profile.organization_number in");
  });

  it("marks transient upstream failures so fresh providers can rotate ahead on the next manual run", async () => {
    const calls: Array<{ query: string; values: unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = queryText(strings);
      calls.push({ query, values });
      if (query.includes("pg_extension")) return [{ ready: true }];
      if (query.includes("profile.id::text")) return [statusRow()];
      if (query.startsWith("insert into company_directory_business_locations")) return [];
      if (query.includes("with provider_state as")) {
        return [{ total: 1, geocoded: 0, remaining: 1, needs_review: 0, unavailable: 0 }];
      }
      throw new Error(`Unexpected SQL: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("temporary upstream failure"));

    const result = await geocodeDirectoryProviderPointsFromAdmin(99);

    expect(result).toMatchObject({ attempted: 1, geocoded: 0, noMatch: 0, errors: 1, remaining: 1 });
    const target = calls.find((call) => call.query.includes("profile.id::text"));
    expect(target?.query).toContain("location.updated_at");
    expect(target?.values).toContain(transientError);
    const transientWrite = calls.find((call) =>
      call.query.startsWith("insert into company_directory_business_locations")
      && call.values.includes(transientError));
    expect(transientWrite).toBeDefined();
  });

  it("authorizes the terminal review page before DB access and executes the provider-wide read-only query", async () => {
    const { default: DirectoryGeocodingReviewPage } = await import(
      "@/app/admin/foretag/directory/search-preview/review/page"
    );

    mocks.requireSuperAdmin.mockRejectedValueOnce(new Error("forbidden"));
    mocks.getSql.mockReturnValue(vi.fn());
    await expect(DirectoryGeocodingReviewPage()).rejects.toThrow("forbidden");
    expect(mocks.getSql).not.toHaveBeenCalled();

    mocks.requireSuperAdmin.mockReset();
    mocks.requireSuperAdmin.mockResolvedValue({ role: "super_admin" });
    mocks.getSql.mockReset();
    const queries: string[] = [];
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = queryText(strings);
      queries.push(query);
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await DirectoryGeocodingReviewPage();

    expect(mocks.requireSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getSql).toHaveBeenCalledTimes(1);
    expect(queries).toHaveLength(1);
    const reviewQuery = queries[0] ?? "";
    expect(reviewQuery).toContain("profile.publication_status = 'published'");
    expect(reviewQuery).toContain("profile.is_active = true");
    expect(reviewQuery).toContain("profile.privacy_blocked = false");
    expect(reviewQuery).toContain("profile.organization_kind = 'juridical_person'");
    expect(reviewQuery).toContain("relation.is_active = true");
    expect(reviewQuery).toContain("relation.public_visible = true");
    expect(reviewQuery).toContain("location.latitude is null or location.longitude is null");
    expect(reviewQuery).toContain("lantmateriet_no_match_v4_2:registerenhet_v2:%");
    expect(reviewQuery).not.toContain("profile.organization_number in");
  });
});