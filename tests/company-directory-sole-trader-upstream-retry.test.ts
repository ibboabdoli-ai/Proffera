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
const DIFFERENT_PRIVATE_OFFICIAL = "198001011111";
const TEST_COMPANY_NAME = "Exempel Service";
const TEST_UPSTREAM_DESCRIPTION = "Test-only upstream producer state";

function producerError(type: string) {
  return {
    dataproducent: "Bolagsverket",
    fel: {
      typ: type,
      felBeskrivning: TEST_UPSTREAM_DESCRIPTION,
    },
  };
}

function identitylessErrorRecord(type: string) {
  return {
    organisationsidentitet: null,
    namnskyddslopnummer: 1,
    organisationsform: producerError(type),
    avregistreradOrganisation: producerError(type),
    organisationsnamn: producerError(type),
  };
}

function activeRecord(identity = PRIVATE_OFFICIAL) {
  return {
    organisationsidentitet: {
      identitetsbeteckning: identity,
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

function response(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

function expectNoPrivateDiagnosticLeak(warn: ReturnType<typeof vi.spyOn>) {
  const logged = JSON.stringify(warn.mock.calls);
  expect(logged).not.toContain(PRIVATE_INPUT);
  expect(logged).not.toContain(PRIVATE_OFFICIAL);
  expect(logged).not.toContain(DIFFERENT_PRIVATE_OFFICIAL);
  expect(logged).not.toContain(TEST_COMPANY_NAME);
  expect(logged).not.toContain(TEST_UPSTREAM_DESCRIPTION);
  return logged;
}

describe("sole-trader upstream retry contract", () => {
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

  it("retries one transient identity-less producer failure inside one user lookup and then succeeds", async () => {
    const { query, persistedValues } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        organisationer: [identitylessErrorRecord("OTILLGANGLIG_UPPGIFTSKALLA")],
      }))
      .mockResolvedValueOnce(response({ organisationer: [activeRecord()] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).resolves.toEqual({
      status: "sole_trader_review_pending",
      companyName: TEST_COMPANY_NAME,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.waitForBolagsverketRequestSlot).toHaveBeenCalledTimes(2);
    expect(mocks.allowPublicSubmission).toHaveBeenCalledTimes(1);
    expect(query.transaction).toHaveBeenCalledTimes(1);
    const persistedText = persistedValues.join("\n");
    expect(persistedText).not.toContain(PRIVATE_INPUT);
    expect(persistedText).not.toContain(PRIVATE_OFFICIAL);

    const logged = expectNoPrivateDiagnosticLeak(warn);
    expect(logged).toContain("producer_error");
    expect(logged).toContain("OTILLGANGLIG_UPPGIFTSKALLA");
    expect(logged).toContain("retrying_transient_producer_error");
  });

  it("stops after one retry when the transient identity-less producer failure persists", async () => {
    const { query } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transient = response({
      organisationer: [identitylessErrorRecord("OTILLGANGLIG_UPPGIFTSKALLA")],
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(transient).mockResolvedValueOnce(transient);
    vi.stubGlobal("fetch", fetchMock);

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).rejects.toThrow("sole_trader_source_error");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.waitForBolagsverketRequestSlot).toHaveBeenCalledTimes(2);
    expect(mocks.allowPublicSubmission).toHaveBeenCalledTimes(1);
    expect(query.transaction).not.toHaveBeenCalled();
    expectNoPrivateDiagnosticLeak(warn);
  });

  it("does not retry deterministic identity-less not-found producer errors", async () => {
    const { query } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(response({
      organisationer: [identitylessErrorRecord("ORGANISATION_FINNS_EJ")],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).rejects.toThrow("sole_trader_source_error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.waitForBolagsverketRequestSlot).toHaveBeenCalledTimes(1);
    expect(query.transaction).not.toHaveBeenCalled();

    const logged = expectNoPrivateDiagnosticLeak(warn);
    expect(logged).toContain("producer_error");
    expect(logged).toContain("ORGANISATION_FINNS_EJ");
    expect(logged).not.toContain("retrying_transient_producer_error");
  });

  it("does not retry a genuine different identified record and logs only the safe identity state", async () => {
    const { query } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(response({
      organisationer: [activeRecord(DIFFERENT_PRIVATE_OFFICIAL)],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).rejects.toThrow("sole_trader_source_error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.waitForBolagsverketRequestSlot).toHaveBeenCalledTimes(1);
    expect(query.transaction).not.toHaveBeenCalled();

    const logged = expectNoPrivateDiagnosticLeak(warn);
    expect(logged).toContain("no_identity_match");
    expect(logged).toContain("different");
    expect(logged).not.toContain("retrying_transient_producer_error");
  });
});
