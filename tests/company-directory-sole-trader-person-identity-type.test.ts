import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
  allowPublicSubmission: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
  waitForBolagsverketRequestSlot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/bolagsverket-api-policy", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/bolagsverket-api-policy")>(
    "../src/lib/bolagsverket-api-policy",
  );
  return {
    ...actual,
    waitForBolagsverketRequestSlot: mocks.waitForBolagsverketRequestSlot,
  };
});
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/public-form-protection", () => ({ allowPublicSubmission: mocks.allowPublicSubmission }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));

import { onboardOwnerSoleTrader } from "../src/lib/company-directory-sole-trader-owner";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";
const PRIVATE_INPUT = "9001011234";
const PRIVATE_OFFICIAL = "199001011234";

function officialRecord(typeCode: string, identity = PRIVATE_OFFICIAL) {
  return {
    organisationsidentitet: {
      identitetsbeteckning: identity,
      typ: { kod: typeCode },
    },
    namnskyddslopnummer: 1,
    organisationsform: { kod: "E", klartext: "Enskild näringsverksamhet" },
    avregistreradOrganisation: null,
    verksamOrganisation: { kod: "JA" },
    organisationsnamn: {
      organisationsnamnLista: [{ namn: "Exempel Service" }],
    },
    postadressOrganisation: { postadress: { postort: "Södertälje" } },
    verksamhetsbeskrivning: { verksamhetsbeskrivning: "Serviceverksamhet" },
  };
}

function createSqlMock() {
  let persisted = false;

  const query = vi.fn((strings: TemplateStringsArray) => {
    const sqlText = strings.join(" ? ").replace(/\s+/g, " ");
    if (sqlText.includes("claimed_workspace_id = ?::uuid") && sqlText.includes("organization_kind = 'sole_trader'")) {
      return Promise.resolve([]);
    }
    if (sqlText.includes("claim.verification_method = 'manual_review'")) {
      return Promise.resolve(persisted ? [{ display_name: "Exempel Service" }] : []);
    }
    return Promise.resolve([]);
  }) as ReturnType<typeof vi.fn> & { transaction: ReturnType<typeof vi.fn> };

  query.transaction = vi.fn(async (callback: (tx: typeof query) => Array<Promise<unknown>>) => {
    const tx = vi.fn(() => Promise.resolve([])) as unknown as typeof query;
    await Promise.all(callback(tx));
    persisted = true;
    return [];
  });

  return query;
}

describe("Bolagsverket PERSON identity type", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mocks.headers.mockReset();
    mocks.getSql.mockReset();
    mocks.getPlatformAdmin.mockReset();
    mocks.allowPublicSubmission.mockReset();
    mocks.getUserWorkspaceAccess.mockReset();
    mocks.canManageWorkspaceSettings.mockReset();
    mocks.waitForBolagsverketRequestSlot.mockReset();

    delete process.env.VERCEL_ENV;
    process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE = "https://example.test/organisationer";
    process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN = "test-token";
    delete process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE;
    delete process.env.COMPANY_DIRECTORY_DETAIL_METHOD;

    mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" }));
    mocks.getUserWorkspaceAccess.mockResolvedValue({
      ok: true,
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      workspaceSlug: "owner-workspace",
      workspaceName: "Owner Workspace",
      workspaceStatus: "active",
      role: "owner",
    });
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.allowPublicSubmission.mockResolvedValue(true);
  });

  it("accepts the Production-observed PERSON code when the identity matches exactly", async () => {
    const query = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organisationer: [officialRecord("PERSON")] }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).resolves.toEqual({
      status: "sole_trader_review_pending",
      companyName: "Exempel Service",
    });
    expect(mocks.waitForBolagsverketRequestSlot).toHaveBeenCalledTimes(1);
    expect(query.transaction).toHaveBeenCalledTimes(1);
  });

  it("still fails closed for PERSON when the returned identity does not match", async () => {
    const query = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organisationer: [officialRecord("PERSON", "198101032384")] }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).rejects.toThrow("sole_trader_source_error");
    expect(query.transaction).not.toHaveBeenCalled();
  });

  it("does not broaden matching to unrelated identity type codes", async () => {
    const query = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organisationer: [officialRecord("ORGANISATIONSNUMMER")] }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).rejects.toThrow("sole_trader_source_error");
    expect(query.transaction).not.toHaveBeenCalled();
  });
});
