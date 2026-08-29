import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const CANONICAL_PRODUCTION_TOKEN_URL = "https://gw.api.bolagsverket.se/oauth2/token";
const CANONICAL_PRODUCTION_DETAIL_URL = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/organisationer";
const PRODUCTION_CLIENT_ID = "production-client-id";
const PRODUCTION_CLIENT_SECRET = "production-client-secret";
const EXPECTED_BASIC_AUTHORIZATION = `Basic ${Buffer.from(`${PRODUCTION_CLIENT_ID}:${PRODUCTION_CLIENT_SECRET}`).toString("base64")}`;

const ENV_KEYS = [
  "VERCEL_ENV",
  "COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE",
  "COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN",
  "COMPANY_DIRECTORY_TOKEN_URL",
  "COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE",
  "COMPANY_DIRECTORY_OAUTH_SCOPE",
  "BOLAGSVERKET_CLIENT_ID",
  "BOLAGSVERKET_CLIENT_SECRET",
] as const;

const originalEnv = new Map<string, string | undefined>();

function officialRecord() {
  return {
    organisationsidentitet: {
      identitetsbeteckning: PRIVATE_OFFICIAL,
      typ: { kod: "PERSONNUMMER" },
    },
    namnskyddslopnummer: 1,
    organisationsform: { kod: "E", klartext: "Enskild näringsverksamhet" },
    avregistreradOrganisation: null,
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

beforeEach(() => {
  originalEnv.clear();
  for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.headers.mockReset();
  mocks.getSql.mockReset();
  mocks.getPlatformAdmin.mockReset();
  mocks.allowPublicSubmission.mockReset();
  mocks.getUserWorkspaceAccess.mockReset();
  mocks.canManageWorkspaceSettings.mockReset();
  mocks.waitForBolagsverketRequestSlot.mockReset();

  process.env.VERCEL_ENV = "production";
  process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE = "https://wrong-environment.example/organisationer/{organizationNumber}";
  process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN = "legacy-static-token";
  process.env.COMPANY_DIRECTORY_TOKEN_URL = "https://wrong-environment.example/oauth2/token";
  process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE = JSON.stringify({ identitetsbeteckning: "191212121212" });
  process.env.COMPANY_DIRECTORY_OAUTH_SCOPE = "wrong:scope";
  process.env.BOLAGSVERKET_CLIENT_ID = PRODUCTION_CLIENT_ID;
  process.env.BOLAGSVERKET_CLIENT_SECRET = PRODUCTION_CLIENT_SECRET;

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
  mocks.getSql.mockReturnValue(createSqlMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("sole-trader Production request contract", () => {
  it("ignores legacy test/static configuration and sends only the canonical Bolagsverket request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "fresh-production-access-token",
          token_type: "Bearer",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ organisationer: [officialRecord()] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(onboardOwnerSoleTrader(PRIVATE_INPUT)).resolves.toEqual({
      status: "sole_trader_review_pending",
      companyName: "Exempel Service",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenRequest] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
    const tokenHeaders = tokenRequest.headers as Record<string, string>;
    expect(String(tokenUrl)).toBe(CANONICAL_PRODUCTION_TOKEN_URL);
    expect(String(tokenUrl)).not.toContain(PRIVATE_INPUT);
    expect(String(tokenUrl)).not.toContain(PRIVATE_OFFICIAL);
    expect(tokenRequest.method).toBe("POST");
    expect(String(tokenRequest.body)).toContain("grant_type=client_credentials");
    expect(String(tokenRequest.body)).toContain("scope=vardefulla-datamangder%3Aread");
    expect(tokenHeaders).toEqual(expect.objectContaining({
      authorization: EXPECTED_BASIC_AUTHORIZATION,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    }));
    expect(Object.values(tokenHeaders).join(" ")).not.toContain("legacy-static-token");

    const [detailUrl, detailRequest] = fetchMock.mock.calls[1] as [URL | string, RequestInit];
    expect(String(detailUrl)).toBe(CANONICAL_PRODUCTION_DETAIL_URL);
    expect(String(detailUrl)).not.toContain(PRIVATE_INPUT);
    expect(String(detailUrl)).not.toContain(PRIVATE_OFFICIAL);
    expect(detailRequest.method).toBe("POST");
    expect(detailRequest.body).toBe(JSON.stringify({ identitetsbeteckning: PRIVATE_OFFICIAL }));
    expect(detailRequest.body).not.toContain("191212121212");
    expect(detailRequest.headers).toEqual(expect.objectContaining({
      authorization: "Bearer fresh-production-access-token",
      "content-type": "application/json",
    }));
  });
});
