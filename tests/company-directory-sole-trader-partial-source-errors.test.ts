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
const TEST_COMPANY_NAME = "Exempel Service";
const TEST_UPSTREAM_DESCRIPTION = "Test-only upstream failure";

function sourceError(type = "ORGANISATION_FINNS_EJ") {
  return {
    dataproducent: "SCB",
    fel: {
      typ: type,
      felBeskrivning: "Test-only producer error",
    },
  };
}

function activeRecord(overrides: Record<string, unknown> = {}) {
  return {
    organisationsidentitet: {
      identitetsbeteckning: PRIVATE_OFFICIAL,
      typ: { kod: "PERSONNR" },
    },
    namnskyddslopnummer: 1,
    organisationsform: {
      dataproducent: "Bolagsverket",
      fel: null,
      kod: "E",
      klartext: "Enskild näringsverksamhet",
    },
    avregistreradOrganisation: {
      dataproducent: "Bolagsverket",
      fel: null,
      avregistreringsdatum: null,
    },
    organisationsnamn: {
      dataproducent: "Bolagsverket",
      fel: null,
      organisationsnamnLista: [{ namn: TEST_COMPANY_NAME }],
    },
    juridiskForm: sourceError(),
    verksamOrganisation: { ...sourceError(), kod: null },
    naringsgrenOrganisation: { ...sourceError(), sni: null },
    reklamsparr: { ...sourceError(), kod: null },
    postadressOrganisation: { ...sourceError(), postadress: null },
    verksamhetsbeskrivning: { ...sourceError(), beskrivning: null },
    ...overrides,
  };
}

function createSqlMock() {
  const persistedValues: string[] = [];
  let persisted = false;

  const query = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sqlText = strings.join(" ? ").replace(/\s+/g, " ");
    persistedValues.push(...values.map((value) => String(value ?? "")));
    if (sqlText.includes("claimed_workspace_id = ?::uuid") && sqlText.includes("organization_kind = 'sole_trader'")) {
      return Promise.resolve([]);
    }
    if (sqlText.includes("claim.verification_method = 'manual_review'")) {
      return Promise.resolve(persisted ? [{ display_name: TEST_COMPANY_NAME }] : []);
    }
    return Promise.resolve([]);
  }) as ReturnType<typeof vi.fn> & { transaction: ReturnType<typeof vi.fn> };

  query.transaction = vi.fn(async (callback: (tx: typeof query) => Array<Promise<unknown>>) => {
    const tx = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      persistedValues.push(...values.map((value) => String(value ?? "")));
      return Promise.resolve([]);
    }) as unknown as typeof query;
    await Promise.all(callback(tx));
    persisted = true;
    return [];
  });

  return { query, persistedValues };
}

describe("sole-trader partial source errors", () => {
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

    process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE = "https://example.test/organisationer";
    process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN = "test-token";
    delete process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE;

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

  it("accepts a current Bolagsverket sole trader when only allowlisted non-critical producer fields have errors", async () => {
    const { query, persistedValues } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ organisationer: [activeRecord()] }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).resolves.toEqual({
      status: "sole_trader_review_pending",
      companyName: TEST_COMPANY_NAME,
    });

    expect(query.transaction).toHaveBeenCalledTimes(1);
    const persistedText = persistedValues.join("\n");
    expect(persistedText).not.toContain(PRIVATE_INPUT);
    expect(persistedText).not.toContain(PRIVATE_OFFICIAL);
  });

  it("fails closed when the deregistration field has a producer error and logs only safe diagnostics", async () => {
    const { query } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        organisationer: [activeRecord({
          avregistreradOrganisation: {
            dataproducent: "Bolagsverket",
            fel: {
              typ: "OTILLGANGLIG_UPPGIFTSKALLA",
              felBeskrivning: TEST_UPSTREAM_DESCRIPTION,
            },
            avregistreringsdatum: null,
          },
        })],
      }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).rejects.toThrow("sole_trader_source_error");
    expect(query.transaction).not.toHaveBeenCalled();

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("producer_error");
    expect(logged).toContain("avregistreradOrganisation");
    expect(logged).toContain("OTILLGANGLIG_UPPGIFTSKALLA");
    expect(logged).not.toContain(PRIVATE_INPUT);
    expect(logged).not.toContain(PRIVATE_OFFICIAL);
    expect(logged).not.toContain(TEST_COMPANY_NAME);
    expect(logged).not.toContain(TEST_UPSTREAM_DESCRIPTION);
  });

  it("fails closed when identity has a producer error even if the identity remains parseable", async () => {
    const { query } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        organisationer: [activeRecord({
          organisationsidentitet: {
            identitetsbeteckning: PRIVATE_OFFICIAL,
            typ: { kod: "PERSONNR" },
            fel: {
              typ: "OTILLGANGLIG_UPPGIFTSKALLA",
              felBeskrivning: TEST_UPSTREAM_DESCRIPTION,
            },
          },
        })],
      }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).rejects.toThrow("sole_trader_source_error");
    expect(query.transaction).not.toHaveBeenCalled();

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("producer_error");
    expect(logged).toContain("organisationsidentitet");
    expect(logged).toContain("OTILLGANGLIG_UPPGIFTSKALLA");
    expect(logged).not.toContain(PRIVATE_INPUT);
    expect(logged).not.toContain(PRIVATE_OFFICIAL);
    expect(logged).not.toContain(TEST_COMPANY_NAME);
    expect(logged).not.toContain(TEST_UPSTREAM_DESCRIPTION);
  });
});
