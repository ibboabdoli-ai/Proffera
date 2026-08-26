import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformAdmin: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({
  getPlatformAdmin: mocks.getPlatformAdmin,
}));
vi.mock("@/lib/db/server", () => ({
  getSql: mocks.getSql,
}));

import {
  buildDirectoryGeocodingNoMatchSource,
  geocodeDirectoryPilotFromAdmin,
  selectDirectoryGeocodingAddress,
  shouldRetryDirectoryNoMatchWithCanonicalAddress,
} from "@/lib/company-directory-geocoding";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_NUMBER = "5563115707";
const VERIFIED_SOURCE = "lantmateriet_belagenhetsadress_v4_2";
const LEGACY_NO_MATCH = "lantmateriet_no_match_v4_2:no_reference";
const CANONICAL_NO_MATCH = "lantmateriet_no_match_v4_2:scb_workplace:no_reference";
const OBJECT_ID = "22222222-2222-4222-8222-222222222222";

const profileAddress = {
  addressLine1: "Gamla vägen 1",
  postalCode: "111 11",
  city: "Stockholm",
  municipality: "Stockholm",
};

const singleScbWorkplace = [{
  cfarNumber: "12345678",
  municipality: "Södertälje",
  visitingAddress: {
    addressLine: "NYA VÄGEN 2",
    postalCode: "151 00",
    city: "SÖDERTÄLJE",
  },
}];

function normalizeQuery(strings: TemplateStringsArray) {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function pilotRow(source: string, latitude: number | null = null, longitude: number | null = null) {
  return {
    id: PROFILE_ID,
    organization_number: ORGANIZATION_NUMBER,
    display_name: "Canonical Geocode AB",
    address_line1: profileAddress.addressLine1,
    postal_code: profileAddress.postalCode,
    city: profileAddress.city,
    municipality: profileAddress.municipality,
    latitude,
    longitude,
    geocode_source: source,
    scb_workplaces: singleScbWorkplace,
    scb_conflicts: [],
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
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

describe("canonical SCB workplace selection for Directory geocoding", () => {
  it("uses a complete conflict-free SCB workplace instead of a stale profile address", () => {
    const selected = selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: singleScbWorkplace,
      scbConflicts: [],
    });

    expect(selected).toEqual({
      source: "scb_workplace",
      address: {
        addressLine1: "NYA VÄGEN 2",
        postalCode: "151 00",
        city: "SÖDERTÄLJE",
        municipality: "Södertälje",
      },
    });
  });

  it("fails closed when SCB workplaces are conflicted or ambiguous", () => {
    expect(selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: singleScbWorkplace,
      scbConflicts: [{ field: "legal_name", code: "legal_name_mismatch" }],
    })).toBeNull();

    const ambiguous = [
      singleScbWorkplace[0],
      {
        cfarNumber: "87654321",
        municipality: "Uppsala",
        visitingAddress: {
          addressLine: "ANNAN VÄG 9",
          postalCode: "753 20",
          city: "UPPSALA",
        },
      },
    ];
    expect(selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: ambiguous,
      scbConflicts: [],
    })).toBeNull();
  });

  it("retries an old no-match only when canonical SCB changed the lookup input", () => {
    const selected = selectDirectoryGeocodingAddress({
      profileAddress,
      scbWorkplaces: singleScbWorkplace,
      scbConflicts: [],
    });
    if (!selected) throw new Error("Expected canonical SCB workplace selection");

    expect(shouldRetryDirectoryNoMatchWithCanonicalAddress({
      geocodeSource: LEGACY_NO_MATCH,
      profileAddress,
      selectedAddress: selected,
    })).toBe(true);
    expect(shouldRetryDirectoryNoMatchWithCanonicalAddress({
      geocodeSource: CANONICAL_NO_MATCH,
      profileAddress,
      selectedAddress: selected,
    })).toBe(false);
    expect(buildDirectoryGeocodingNoMatchSource("no_reference", "scb_workplace"))
      .toBe(CANONICAL_NO_MATCH);
  });
});

describe("Directory geocoding pilot canonical-address behavior", () => {
  it("queries Lantmäteriet with the SCB workplace and preserves the verified success contract", async () => {
    let storedSource = LEGACY_NO_MATCH;
    let storedLatitude: number | null = null;
    let storedLongitude: number | null = null;
    const sqlCalls: Array<{ query: string; values: unknown[] }> = [];

    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = normalizeQuery(strings);
      sqlCalls.push({ query, values });
      if (query.includes("select exists(") && query.includes("pg_extension")) return [{ ready: true }];
      if (query.includes("profile.id::text") && query.includes("scb.workplaces as scb_workplaces")) {
        return [pilotRow(storedSource, storedLatitude, storedLongitude)];
      }
      if (query.startsWith("with transformed as")) {
        storedSource = VERIFIED_SOURCE;
        storedLatitude = 59.1955;
        storedLongitude = 17.6253;
        return [{ profile_id: PROFILE_ID }];
      }
      if (query.includes("profile.organization_number") && query.includes("location.latitude::float8")) {
        return [pilotRow(storedSource, storedLatitude, storedLongitude)];
      }
      throw new Error(`Unexpected SQL: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([{
        objektidentitet: OBJECT_ID,
        adress: "NYA VÄGEN 2, 151 00 Södertälje",
        adressComponents: { postnummer: 15100, postort: "Södertälje" },
      }]))
      .mockResolvedValueOnce(jsonResponse({
        type: "FeatureCollection",
        features: [{
          geometry: { type: "Point", coordinates: [674000, 6580000] },
          properties: {
            adressplatsattribut: {
              postnummer: 15100,
              postort: "Södertälje",
              adressplatsbeteckning: { adressplatsnummer: "2" },
            },
            adressomrade: { faststalltNamn: "NYA VÄGEN" },
          },
        }],
      }));

    const result = await geocodeDirectoryPilotFromAdmin(5);

    expect(result).toMatchObject({
      attempted: 1,
      geocoded: 1,
      noMatch: 0,
      errors: 0,
      remaining: 0,
      needsReview: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const referenceUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(referenceUrl.pathname.endsWith("/uppslag/adress/v3/fritext")).toBe(true);
    expect(referenceUrl.searchParams.get("adress")).toBe("NYA VÄGEN 2, SÖDERTÄLJE");
    const save = sqlCalls.find((call) => call.query.startsWith("with transformed as"));
    expect(save?.values).toContain(VERIFIED_SOURCE);
  });

  it("marks a failed canonical retry so the next run does not call Lantmäteriet again", async () => {
    let storedSource = LEGACY_NO_MATCH;
    const sqlCalls: Array<{ query: string; values: unknown[] }> = [];

    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = normalizeQuery(strings);
      sqlCalls.push({ query, values });
      if (query.includes("select exists(") && query.includes("pg_extension")) return [{ ready: true }];
      if (query.includes("profile.id::text") && query.includes("scb.workplaces as scb_workplaces")) {
        return [pilotRow(storedSource)];
      }
      if (query.startsWith("insert into company_directory_business_locations")) {
        const canonicalSource = values.find((value) => String(value).startsWith("lantmateriet_no_match_v4_2:"));
        storedSource = String(canonicalSource);
        return [];
      }
      if (query.includes("profile.organization_number") && query.includes("location.latitude::float8")) {
        return [pilotRow(storedSource)];
      }
      throw new Error(`Unexpected SQL: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));

    const first = await geocodeDirectoryPilotFromAdmin(5);
    expect(first).toMatchObject({ attempted: 1, geocoded: 0, noMatch: 1, errors: 0, remaining: 0, needsReview: 1 });
    expect(storedSource).toBe(CANONICAL_NO_MATCH);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    const second = await geocodeDirectoryPilotFromAdmin(5);
    expect(second).toMatchObject({ attempted: 0, geocoded: 0, noMatch: 0, errors: 0, remaining: 0, needsReview: 1 });
    expect(fetchMock).not.toHaveBeenCalled();

    const noMatchWrite = sqlCalls.find((call) =>
      call.query.startsWith("insert into company_directory_business_locations")
      && call.values.includes(CANONICAL_NO_MATCH));
    expect(noMatchWrite).toBeDefined();
  });

  it("does not geocode an unresolved canonical workplace even for a legacy diagnostic retry org", async () => {
    const unresolvedRow = {
      ...pilotRow("lantmateriet_no_match_v4_2"),
      organization_number: "5564208337",
      scb_conflicts: [{ field: "legal_name", code: "legal_name_mismatch" }],
    };
    const sqlCalls: Array<{ query: string; values: unknown[] }> = [];

    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = normalizeQuery(strings);
      sqlCalls.push({ query, values });
      if (query.includes("select exists(") && query.includes("pg_extension")) return [{ ready: true }];
      if (query.includes("profile.id::text") && query.includes("scb.workplaces as scb_workplaces")) {
        return [unresolvedRow];
      }
      if (query.includes("profile.organization_number") && query.includes("location.latitude::float8")) {
        return [unresolvedRow];
      }
      throw new Error(`Unexpected SQL: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await geocodeDirectoryPilotFromAdmin(5);

    expect(result).toMatchObject({
      attempted: 0,
      geocoded: 0,
      noMatch: 0,
      errors: 0,
      remaining: 0,
      needsReview: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sqlCalls.some((call) => call.query.startsWith("insert into company_directory_business_locations")))
      .toBe(false);
    expect(sqlCalls.some((call) => call.query.startsWith("with transformed as"))).toBe(false);
  });
});
