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

import {
  approveSoleTraderDirectoryClaim,
  onboardOwnerSoleTrader,
} from "../src/lib/company-directory-sole-trader-owner";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";
const PRIVATE_INPUT = "9001011234";
const PRIVATE_OFFICIAL = "199001011234";

function officialRecord(overrides: Record<string, unknown> = {}) {
  return {
    organisationsidentitet: {
      identitetsbeteckning: PRIVATE_OFFICIAL,
      typ: { kod: "PERSONNUMMER" },
    },
    organisationsform: { kod: "E", klartext: "Enskild näringsidkare" },
    organisationsnamn: {
      organisationsnamnLista: [{ namn: "Exempel Service" }],
    },
    postadressOrganisation: { postadress: { postort: "Södertälje" } },
    verksamhetsbeskrivning: { verksamhetsbeskrivning: "Serviceverksamhet" },
    ...overrides,
  };
}

function createSqlMock() {
  const persistedValues: string[] = [];
  let persisted = false;

  const query = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sqlText = strings.join(" ? ").replace(/\s+/g, " ");
    persistedValues.push(...values.map((value) => String(value ?? "")));
    if (sqlText.includes("publication_status = 'claimed'")) return Promise.resolve([]);
    if (sqlText.includes("claim.verification_method = 'manual_review'")) {
      return Promise.resolve(persisted ? [{ display_name: "Exempel Service" }] : []);
    }
    return Promise.resolve([]);
  }) as ReturnType<typeof vi.fn> & { transaction: ReturnType<typeof vi.fn> };

  query.transaction = vi.fn(async (callback: (tx: typeof query) => Array<Promise<unknown>> ) => {
    const tx = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      persistedValues.push(...values.map((value) => String(value ?? "")));
      return Promise.resolve([]);
    }) as unknown as typeof query;
    const statements = callback(tx);
    await Promise.all(statements);
    persisted = true;
    return [];
  });

  return { query, persistedValues };
}

describe("privacy-safe sole-trader owner verification", () => {
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
    process.env.COMPANY_DIRECTORY_DETAIL_METHOD = "POST";
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

  it("uses the private identity only for the live official lookup and discards it before DB persistence", async () => {
    const { query, persistedValues } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organisationer: [officialRecord()] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).resolves.toEqual({
      status: "sole_trader_review_pending",
      companyName: "Exempel Service",
    });

    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith(expect.objectContaining({
      scope: "owner_sole_trader_onboarding",
      identity: `${WORKSPACE_ID}:${USER_ID}`,
      maxAttempts: 4,
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(request.body)).toContain(PRIVATE_OFFICIAL);
    expect(persistedValues).not.toContain(PRIVATE_INPUT);
    expect(persistedValues).not.toContain(PRIVATE_OFFICIAL);
    expect(persistedValues.some((value) => value.startsWith("sole-trader-"))).toBe(true);
  });

  it("fails closed when more than one current sole-trader business matches the same identity", async () => {
    const { query } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organisationer: [
          officialRecord(),
          officialRecord({ organisationsnamn: { organisationsnamnLista: [{ namn: "Exempel Service Två" }] } }),
        ],
      }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).resolves.toEqual({
      status: "sole_trader_ambiguous",
      companyName: "Exempel Service",
    });
    expect(query.transaction).not.toHaveBeenCalled();
  });

  it("does not create a claim for a deregistered sole trader", async () => {
    const { query } = createSqlMock();
    mocks.getSql.mockReturnValue(query);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organisationer: [officialRecord({
          avregistreradOrganisation: { avregistreringsdatum: "2025-01-01" },
        })],
      }),
    }));

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).resolves.toEqual({
      status: "sole_trader_not_active",
      companyName: "Exempel Service",
    });
    expect(query.transaction).not.toHaveBeenCalled();
  });

  it("rejects admin evidence that attempts to copy a personal identifier into audit/reference text", async () => {
    mocks.getPlatformAdmin.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
    mocks.getSql.mockReturnValue(vi.fn());

    await expect(approveSoleTraderDirectoryClaim({
      claimId: "22222222-2222-4222-8222-222222222222",
      reference: "Kontrollerad identitet 900101-1234",
    })).rejects.toThrow("Do not include personal identifiers");
  });
});
