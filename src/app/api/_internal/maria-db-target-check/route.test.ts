import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  access: vi.fn(), connect: vi.fn(), query: vi.fn(), end: vi.fn(),
}));
vi.mock("@/lib/workspace-access", () => ({ getUserWorkspaceAccess: mock.access }));
vi.mock("pg", () => ({
  Client: class {
    connect = mock.connect;
    query = mock.query;
    end = mock.end;
  },
}));

import { GET } from "./route";

const syntheticUrl = "postgresql://fake-user:fake-secret@ep-shy-forest-aduyugb7.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const url = "https://www.proffera.se/api/_internal/maria-db-target-check";
const token = "c".repeat(64);
function request(candidate: string = token, endpoint: string = url) {
  return new Request(endpoint, { headers: { "x-maria-db-proof": candidate } });
}
const probe = { database_name: "neondb", transaction_read_only: true, maria_workspace_count: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("DATABASE_URL", syntheticUrl);
  vi.stubEnv("PROFFERA_MARIA_DB_PROOF_ENABLED", "true");
  vi.stubEnv("PROFFERA_MARIA_DB_PROOF_TOKEN", token);
  vi.stubEnv("NEON_PROJECT_ID", "late-water-28070748");
  vi.stubEnv("VERCEL_PROJECT_ID", "prj_N56e3ZLZLKq88msVCsltbe9tlauC");
  mock.access.mockResolvedValue({ ok: true, role: "owner", workspaceSlug: "makeup-by-maria" });
  mock.connect.mockResolvedValue(undefined);
  mock.query.mockImplementation(async (sql: string) => sql.trim().startsWith("select current_database()")
    ? { rows: [probe] } : { rows: [] });
  mock.end.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("isolated Maria Production database proof route", () => {
  it("is off by default and never executes in Preview", async () => {
    vi.stubEnv("PROFFERA_MARIA_DB_PROOF_ENABLED", undefined);
    expect((await GET(request())).status).toBe(404);
    vi.stubEnv("PROFFERA_MARIA_DB_PROOF_ENABLED", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(request())).status).toBe(404);
    expect(mock.access).not.toHaveBeenCalled();
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("requires exact host, owner session, selected workspace and token", async () => {
    expect((await GET(request("wrong"))).status).toBe(404);
    expect((await GET(request(token, "https://makeupbymaria.se/api/_internal/maria-db-target-check"))).status).toBe(404);
    for (const access of [
      { ok: false }, { ok: true, role: "staff", workspaceSlug: "makeup-by-maria" },
      { ok: true, role: "owner", workspaceSlug: "other-tenant" },
    ]) {
      mock.access.mockResolvedValueOnce(access);
      expect((await GET(request())).status).toBe(404);
    }
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("rejects short or missing configuration tokens", async () => {
    vi.stubEnv("PROFFERA_MARIA_DB_PROOF_TOKEN", "short");
    expect((await GET(request("short"))).status).toBe(404);
    vi.stubEnv("PROFFERA_MARIA_DB_PROOF_TOKEN", undefined);
    expect((await GET(request())).status).toBe(404);
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("refuses a different URL target or Neon/Vercel project hint before connecting", async () => {
    vi.stubEnv("DATABASE_URL", syntheticUrl.replace("ep-shy-forest", "ep-other"));
    expect((await GET(request())).status).toBe(409);
    vi.stubEnv("DATABASE_URL", syntheticUrl);
    vi.stubEnv("NEON_PROJECT_ID", "wrong-project");
    expect((await GET(request())).status).toBe(409);
    vi.stubEnv("NEON_PROJECT_ID", "late-water-28070748");
    vi.stubEnv("VERCEL_PROJECT_ID", "wrong-vercel-project");
    expect((await GET(request())).status).toBe(409);
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("never falls back to another database when DATABASE_URL points elsewhere", async () => {
    vi.stubEnv("DATABASE_URL", syntheticUrl.replace("ep-shy-forest", "ep-wrong"));
    vi.stubEnv("POSTGRES_URL", syntheticUrl);
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ targetVerified: false });
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("uses one SELECT in a READ ONLY transaction and returns only a boolean", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ targetVerified: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mock.query.mock.calls.map(([sql]) => sql.trim())).toEqual([
      "BEGIN TRANSACTION READ ONLY",
      "SET LOCAL statement_timeout = '4s'",
      expect.stringContaining("select current_database()"),
      "ROLLBACK",
    ]);
    expect(mock.end).toHaveBeenCalledOnce();
  });

  it("fails closed on mismatched database or SQL error without echoing credentials", async () => {
    mock.query.mockImplementationOnce(async () => ({ rows: [] }))
      .mockImplementationOnce(async () => ({ rows: [] }))
      .mockImplementationOnce(async () => ({ rows: [{ ...probe, maria_workspace_count: 0 }] }))
      .mockImplementationOnce(async () => ({ rows: [] }));
    const mismatch = await GET(request());
    expect(mismatch.status).toBe(409);
    expect(await mismatch.json()).toEqual({ targetVerified: false });
    mock.connect.mockRejectedValueOnce(new Error("postgresql://secret-user:secret-password@secret-host/hidden"));
    const failure = await GET(request());
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({ targetVerified: false });
    expect(mock.end).toHaveBeenCalledTimes(2);
  });
});
