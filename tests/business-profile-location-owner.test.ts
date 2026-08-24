import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));

import {
  createOwnerBusinessProfileLocation,
  deactivateOwnerBusinessProfileLocation,
  listAdminBusinessProfileLocations,
  listOwnerBusinessProfileLocations,
  normalizeBusinessProfileLocationWrite,
  updateOwnerBusinessProfileLocation,
  type WriteBusinessProfileLocationInput,
} from "../src/lib/business-profile-location-owner";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const LOCATION_ID = "33333333-3333-4333-8333-333333333333";

function queryText(strings: TemplateStringsArray) {
  return strings.join(" ? ").replace(/\s+/g, " ").replace(/\?\s+::/g, "?::").trim();
}

type QueryRecord = { text: string; values: unknown[] };

function createSqlMock(handler: (query: QueryRecord) => unknown[] | Promise<unknown[]>) {
  const queries: QueryRecord[] = [];
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: queryText(strings), values };
    queries.push(query);
    const promise = Promise.resolve().then(() => handler(query));
    return promise;
  }) as ReturnType<typeof vi.fn> & {
    transaction: ReturnType<typeof vi.fn>;
  };
  sql.transaction = vi.fn(async (pending: Array<Promise<unknown[]>>) => Promise.all(pending));
  return { sql, queries };
}

function ownerAccess(role: "owner" | "admin" | "staff" = "owner") {
  return {
    ok: true as const,
    userId: "user-1",
    workspaceId: WORKSPACE_ID,
    workspaceSlug: "owner-company",
    workspaceName: "Owner Company",
    workspaceStatus: "active" as const,
    role,
  };
}

function validInput(overrides: Partial<WriteBusinessProfileLocationInput> = {}): WriteBusinessProfileLocationInput {
  return {
    purpose: "storefront",
    visibility: "private",
    isVisitable: true,
    isPrimary: false,
    confirmed: false,
    addressLine1: "Storgatan 1",
    postalCode: "151 00",
    city: "Södertälje",
    municipality: "Södertälje",
    latitude: 59.1955,
    longitude: 17.6253,
    geocodeSource: "owner",
    geocodePrecision: "address",
    ...overrides,
  };
}

describe("Business Profile claimed-owner location boundary", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getUserWorkspaceAccess.mockResolvedValue(ownerAccess());
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.getPlatformAdmin.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
  });

  it("normalizes safe location data and rejects unsafe publication or coordinate states", () => {
    expect(normalizeBusinessProfileLocationWrite(validInput({
      latitude: " 59.1955 ",
      longitude: " 17.6253 ",
      addressLine1: "  Storgatan 1  ",
    }))).toMatchObject({
      addressLine1: "Storgatan 1",
      latitude: 59.1955,
      longitude: 17.6253,
    });

    expect(normalizeBusinessProfileLocationWrite(validInput({
      latitude: "   ",
      longitude: "   ",
    }))).toMatchObject({ latitude: null, longitude: null });

    expect(() => normalizeBusinessProfileLocationWrite(validInput({
      visibility: "public",
      isVisitable: true,
      confirmed: false,
    }))).toThrow("explicitly confirmed");

    expect(() => normalizeBusinessProfileLocationWrite(validInput({
      visibility: "public",
      isVisitable: false,
      confirmed: true,
    }))).toThrow("visitable");

    for (const unsafeFlags of [
      { isVisitable: "false", confirmed: "false" },
      { isPrimary: "false" },
    ]) {
      expect(() => normalizeBusinessProfileLocationWrite({
        ...validInput({ visibility: "public", isVisitable: true, confirmed: true }),
        ...unsafeFlags,
      } as unknown as WriteBusinessProfileLocationInput)).toThrow("state flags must be booleans");
    }

    expect(() => normalizeBusinessProfileLocationWrite(validInput({
      latitude: 59.1955,
      longitude: null,
    }))).toThrow("provided together");

    expect(() => normalizeBusinessProfileLocationWrite(validInput({ latitude: 91 }))).toThrow("Latitude");

    expect(() => normalizeBusinessProfileLocationWrite({
      ...validInput(),
      purpose: "registered",
    } as unknown as WriteBusinessProfileLocationInput)).toThrow("Only workplace");
  });

  it("requires a managing Workspace role before any owner location read", async () => {
    mocks.getUserWorkspaceAccess.mockResolvedValue(ownerAccess("staff"));
    mocks.canManageWorkspaceSettings.mockReturnValue(false);

    await expect(listOwnerBusinessProfileLocations()).rejects.toThrow("owner or admin access");
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("lists only through the server-resolved claimed Workspace and excludes stale owner provenance", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select location.id::text")) return [];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(listOwnerBusinessProfileLocations()).resolves.toEqual([]);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.text).toContain("profile.claimed_workspace_id = ?::uuid");
    expect(queries[0]?.text).toContain("location.owner_workspace_id = ?::uuid");
    expect(queries[0]?.text).toContain("profile.publication_status = 'claimed'");
    expect(queries[0]?.values).toEqual([WORKSPACE_ID, WORKSPACE_ID]);
  });

  it("creates owner provenance from the verified Workspace and serializes primary changes inside one transaction", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id")) return [{ id: PROFILE_ID }];
      if (query.text.startsWith("insert into company_directory_profile_locations")) return [{ id: LOCATION_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await createOwnerBusinessProfileLocation(validInput({ isPrimary: true }));

    expect(result).toEqual({ id: LOCATION_ID });
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    expect(queries).toHaveLength(3);
    expect(queries[0]?.text).toContain("for update");
    expect(queries[1]?.text).toContain("set is_primary = false");
    expect(queries[2]?.text).toContain("'owner'");
    expect(queries[2]?.text).toContain("profile.claimed_workspace_id = ?::uuid");
    expect(queries[2]?.values).toContain(WORKSPACE_ID);
  });

  it("fails closed for an unclaimed Workspace profile", async () => {
    const { sql } = createSqlMock(async () => []);
    mocks.getSql.mockReturnValue(sql);

    await expect(createOwnerBusinessProfileLocation(validInput())).rejects.toThrow(
      "does not own an eligible claimed Business Profile",
    );
  });

  it("rejects a blank update id before resolving Workspace or database access", async () => {
    await expect(updateOwnerBusinessProfileLocation({
      ...validInput(),
      id: "   ",
    })).rejects.toThrow("location id is required");

    expect(mocks.getUserWorkspaceAccess).not.toHaveBeenCalled();
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("cannot update a stale owner row and guards primary cleanup behind target ownership", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id")) return [{ id: PROFILE_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(updateOwnerBusinessProfileLocation(validInput({
      id: LOCATION_ID,
      isPrimary: true,
    }) as WriteBusinessProfileLocationInput & { id: string })).rejects.toThrow(
      "not owned by the currently claimed Workspace",
    );

    expect(queries[1]?.text).toContain("exists ( select 1 from company_directory_profile_locations target");
    expect(queries[1]?.text).toContain("target.source_type = 'owner'");
    expect(queries[1]?.text).toContain("target.owner_workspace_id = ?::uuid");
    expect(queries[2]?.text).toContain("location.source_type = 'owner'");
    expect(queries[2]?.text).toContain("location.owner_workspace_id = ?::uuid");
  });

  it("serializes deactivation with primary writes and keeps it bound to the active claim", async () => {
    const { sql, queries } = createSqlMock(async (query) => {
      if (query.text.startsWith("select profile.id")) return [{ id: PROFILE_ID }];
      if (query.text.startsWith("update company_directory_profile_locations")) return [{ id: LOCATION_ID }];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(deactivateOwnerBusinessProfileLocation(LOCATION_ID)).resolves.toBeUndefined();

    expect(sql.transaction).toHaveBeenCalledTimes(1);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.text).toContain("for update");
    expect(queries[0]?.text).toContain("profile.claimed_workspace_id = ?::uuid");
    expect(queries[1]?.text).toContain("location.source_type = 'owner'");
    expect(queries[1]?.text).toContain("location.owner_workspace_id = ?::uuid");
    expect(queries[1]?.text).toContain("profile.claimed_workspace_id = ?::uuid");
    expect(queries[1]?.text).toContain("visibility = 'private'");
  });

  it("keeps super-admin inspection behind the existing platform-admin boundary", async () => {
    const { sql } = createSqlMock(async () => []);
    mocks.getSql.mockReturnValue(sql);
    mocks.getPlatformAdmin.mockResolvedValue({ userId: "admin-1", role: "support_admin" });

    await expect(listAdminBusinessProfileLocations(PROFILE_ID)).rejects.toThrow("Super admin access required");
    expect(mocks.getSql).not.toHaveBeenCalled();
  });
});
