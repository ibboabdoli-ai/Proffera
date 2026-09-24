import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
  verifyCustomerAddress: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));
vi.mock("@/lib/lantmateriet-address-verification", () => ({
  CUSTOMER_ADDRESS_VERIFICATION_SOURCE: "lantmateriet_belagenhetsadress_v4_2",
  verifyCustomerAddress: mocks.verifyCustomerAddress,
}));

import {
  createOwnerBusinessProfileLocation,
  establishPreReleaseSoleTraderServiceBase,
  updateOwnerBusinessProfileLocation,
} from "@/lib/business-profile-location-owner";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const LOCATION_ID = "33333333-3333-4333-8333-333333333333";

type QueryRecord = { text: string; values: unknown[] };

function queryText(strings: TemplateStringsArray) {
  return strings.join(" ? ").replace(/\s+/g, " ").replace(/\?\s+::/g, "?::").trim();
}

function createSqlMock(handler: (query: QueryRecord) => unknown[] | Promise<unknown[]>) {
  const queries: QueryRecord[] = [];
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: queryText(strings), values };
    queries.push(query);
    return Promise.resolve().then(() => handler(query));
  }) as ReturnType<typeof vi.fn> & {
    transaction: ReturnType<typeof vi.fn>;
  };
  sql.transaction = vi.fn(async (pending: Array<Promise<unknown[]>>) => Promise.all(pending));
  return { sql, queries };
}

function ownerAccess() {
  return {
    ok: true as const,
    userId: "user-1",
    workspaceId: WORKSPACE_ID,
    workspaceSlug: "owner-company",
    workspaceName: "Owner Company",
    workspaceStatus: "active" as const,
    role: "owner" as const,
  };
}

function serviceBaseInput(overrides: Record<string, unknown> = {}) {
  return {
    purpose: "service_base" as const,
    visibility: "private" as const,
    isVisitable: true,
    isPrimary: false,
    confirmed: true,
    addressLine1: "Industrivägen 2",
    postalCode: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
    latitude: 1,
    longitude: 2,
    geocodeSource: "caller_forged",
    geocodePrecision: "rooftop" as const,
    ...overrides,
  };
}

describe("owner service-base verification boundary", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getUserWorkspaceAccess.mockResolvedValue(ownerAccess());
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.getPlatformAdmin.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
  });

  it("authorizes first, verifies exact address server-side, transforms SWEREF, and ignores caller coordinates", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id::text as profile_id")) {
        return [{ profile_id: PROFILE_ID }];
      }
      if (query.text.includes("st_y(transformed.point)::float8 as latitude")) {
        return [{ latitude: 59.1955, longitude: 17.6253 }];
      }
      if (query.text.startsWith("select profile.id from company_directory_profiles")) {
        return [{ id: PROFILE_ID }];
      }
      if (query.text.startsWith("insert into company_directory_profile_locations")) {
        return [{ id: LOCATION_ID }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);
    mocks.verifyCustomerAddress.mockResolvedValue({
      status: "matched",
      source: "lantmateriet_belagenhetsadress_v4_2",
      referenceId: "44444444-4444-4444-8444-444444444444",
      easting: 658123,
      northing: 6570123,
    });

    await expect(createOwnerBusinessProfileLocation(serviceBaseInput())).resolves.toEqual({ id: LOCATION_ID });

    expect(queries[0]?.text).toContain("profile.claimed_workspace_id = ?::uuid");
    expect(queries[0]?.values).toContain(WORKSPACE_ID);
    expect(mocks.verifyCustomerAddress).toHaveBeenCalledTimes(1);
    expect(mocks.verifyCustomerAddress).toHaveBeenCalledWith({
      addressLine1: "Industrivägen 2",
      postalCode: "151 00",
      city: "Södertälje",
    });
    const transform = queries.find((query) => query.text.includes("st_transform"));
    expect(transform?.values).toEqual([658123, 6570123]);

    const insert = queries.find((query) => query.text.startsWith("insert into company_directory_profile_locations"));
    expect(insert?.values).toContain(59.1955);
    expect(insert?.values).toContain(17.6253);
    expect(insert?.values).toContain("lantmateriet_belagenhetsadress_v4_2");
    expect(insert?.values).toContain("address");
    expect(insert?.values).not.toContain("caller_forged");
    expect(insert?.values).not.toContain(1);
    expect(insert?.values).not.toContain(2);
    expect(sql.transaction).toHaveBeenCalledTimes(1);
  });

  it("stores one verified private primary service base for the reviewed blocked sole-trader boundary", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id::text as profile_id")) return [{ profile_id: PROFILE_ID }];
      if (query.text.includes("st_y(transformed.point)::float8 as latitude")) {
        return [{ latitude: 59.1955, longitude: 17.6253 }];
      }
      if (query.text.startsWith("select profile.id from company_directory_profiles")) return [{ id: PROFILE_ID }];
      if (query.text.startsWith("with selected_location as")) return [{ id: LOCATION_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);
    mocks.verifyCustomerAddress.mockResolvedValue({
      status: "matched",
      source: "lantmateriet_belagenhetsadress_v4_2",
      referenceId: "44444444-4444-4444-8444-444444444444",
      easting: 658123,
      northing: 6570123,
    });

    await expect(establishPreReleaseSoleTraderServiceBase({
      addressLine1: "Industrivägen 2",
      postalCode: "151 00",
      city: "Södertälje",
    })).resolves.toEqual({ id: LOCATION_ID });

    expect(queries[0]?.text).toContain("profile.publication_status = 'blocked'");
    expect(queries[0]?.text).toContain("owner_claim.verification_method = 'manual_review'");
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    const transactionQueries = sql.transaction.mock.calls[0]?.[0] as Promise<unknown[]>[];
    expect(transactionQueries).toHaveLength(3);
    expect(queries[2]?.text).toContain("for update of profile, owner_claim");
    expect(queries[3]?.text).toContain("set is_primary = false");
    const write = queries.find((query) => query.text.startsWith("with selected_location as"));
    expect(write?.text).toContain("'service_base', 'private', true, true");
    expect(write?.text).toContain("order by location.updated_at desc, location.id");
    expect(write?.text).toContain("municipality = ''");
    expect(write?.values).toContain("lantmateriet_belagenhetsadress_v4_2");
    expect(write?.values).toContain(59.1955);
    expect(write?.values).toContain(17.6253);
  });

  it("makes no provider call for an unconfirmed service base and clears supplied geocoding", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id from company_directory_profiles")) {
        return [{ id: PROFILE_ID }];
      }
      if (query.text.startsWith("insert into company_directory_profile_locations")) {
        return [{ id: LOCATION_ID }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(createOwnerBusinessProfileLocation(serviceBaseInput({ confirmed: false }))).resolves.toEqual({ id: LOCATION_ID });

    expect(mocks.verifyCustomerAddress).not.toHaveBeenCalled();
    expect(queries.some((query) => query.text.includes("st_transform"))).toBe(false);
    const insert = queries.find((query) => query.text.startsWith("insert into company_directory_profile_locations"));
    expect(insert?.values).not.toContain("caller_forged");
    expect(insert?.values).not.toContain(1);
    expect(insert?.values).not.toContain(2);
    expect(insert?.values).toContain("unknown");
  });

  it("rejects an unauthorized confirmed service base before any provider call or write transaction", async () => {
    const { sql, queries } = createSqlMock(async () => []);
    mocks.getSql.mockReturnValue(sql);

    await expect(createOwnerBusinessProfileLocation(serviceBaseInput())).rejects.toThrow(
      "does not own an eligible claimed Business Profile",
    );

    expect(queries).toHaveLength(1);
    expect(mocks.verifyCustomerAddress).not.toHaveBeenCalled();
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it("reuses existing exact server-owned coordinates for an unchanged confirmed service base", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id::text as profile_id")) {
        return [{
          profile_id: PROFILE_ID,
          address_line1: "Industrivägen 2",
          postal_code: "151 00",
          city: "Södertälje",
          municipality: "Södertälje",
          latitude: 59.21,
          longitude: 17.64,
          geocode_source: "lantmateriet_belagenhetsadress_v4_2",
          geocode_precision: "address",
          confirmed_at: "2026-09-15T08:00:00.000Z",
        }];
      }
      if (query.text.startsWith("select profile.id from company_directory_profiles")) {
        return [{ id: PROFILE_ID }];
      }
      if (query.text.startsWith("update company_directory_profile_locations location set purpose")) {
        return [{ id: LOCATION_ID }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(updateOwnerBusinessProfileLocation({
      ...serviceBaseInput(),
      id: LOCATION_ID,
      latitude: 3,
      longitude: 4,
      geocodeSource: "caller_forged",
    })).resolves.toEqual({ id: LOCATION_ID });

    expect(mocks.verifyCustomerAddress).not.toHaveBeenCalled();
    expect(queries.some((query) => query.text.includes("st_transform"))).toBe(false);
    const update = queries.find((query) => query.text.startsWith("update company_directory_profile_locations location set purpose"));
    expect(update?.values).toContain(59.21);
    expect(update?.values).toContain(17.64);
    expect(update?.values).toContain("lantmateriet_belagenhetsadress_v4_2");
    expect(update?.values).not.toContain("caller_forged");
    expect(update?.values).not.toContain(3);
    expect(update?.values).not.toContain(4);
  });

  it.each([
    { status: "no_match", reason: "no_reference" },
    { status: "unavailable", reason: "upstream_error" },
  ])("fails closed without a write when exact verification returns $status", async (verification) => {
    const { sql } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id::text as profile_id")) {
        return [{ profile_id: PROFILE_ID }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);
    mocks.verifyCustomerAddress.mockResolvedValue(verification);

    await expect(createOwnerBusinessProfileLocation(serviceBaseInput())).rejects.toThrow(
      "Service base address verification failed",
    );

    expect(mocks.verifyCustomerAddress).toHaveBeenCalledTimes(1);
    expect(sql.transaction).not.toHaveBeenCalled();
  });
});
