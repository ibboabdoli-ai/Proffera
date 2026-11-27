import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  access: vi.fn(), connect: vi.fn(), query: vi.fn(), end: vi.fn(),
  put: vi.fn(), markers: new Set<string>(),
}));
vi.mock("@/lib/workspace-access", () => ({ getUserWorkspaceAccess: mock.access }));
vi.mock("@vercel/blob", () => ({ put: mock.put }));
vi.mock("pg", () => ({
  Client: class {
    connect = mock.connect;
    query = mock.query;
    end = mock.end;
  },
}));

import { GET } from "./route";

const syntheticUrl = "postgresql://fake-user:fake-secret@ep-shy-forest-aduyugb7.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const url = "https://www.proffera.se/api/maria-db-target-check";
const token = "c".repeat(64);
function request(candidate: string = token, endpoint: string = url) {
  return new Request(endpoint, { headers: { "x-maria-db-proof": candidate } });
}
const probe = { database_name: "neondb", transaction_read_only: true, maria_workspace_count: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  mock.markers.clear();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("DATABASE_URL", syntheticUrl);
  vi.stubEnv("PROFFERA_MARIA_DB_PROOF_ENABLED", "true");
  vi.stubEnv("PROFFERA_MARIA_DB_PROOF_TOKEN", token);
  vi.stubEnv("PROFFERA_MARIA_DB_PROOF_EXPIRES_AT", new Date(Date.now() + 60_000).toISOString());
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "synthetic-blob-token");
  vi.stubEnv("NEON_PROJECT_ID", "late-water-28070748");
  vi.stubEnv("VERCEL_PROJECT_ID", "prj_N56e3ZLZLKq88msVCsltbe9tlauC");
  mock.access.mockResolvedValue({ ok: true, role: "owner", workspaceSlug: "makeup-by-maria" });
  mock.put.mockImplementation(async (pathname: string) => {
    if (mock.markers.has(pathname)) throw new Error("pathname already exists");
    mock.markers.add(pathname);
    return { pathname };
  });
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
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("requires a valid UTC expiry within a ten-minute window", async () => {
    for (const expiry of [undefined, "tomorrow", new Date(Date.now() - 1).toISOString(),
      new Date(Date.now() + 11 * 60_000).toISOString()]) {
      vi.stubEnv("PROFFERA_MARIA_DB_PROOF_EXPIRES_AT", expiry);
      expect((await GET(request())).status).toBe(404);
    }
    expect(mock.access).not.toHaveBeenCalled();
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("rejects normalized impossible dates and accepts both UTC timestamp formats", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2027-03-02T12:00:00Z"));
      for (const expiry of ["2027-02-30T12:01:00Z", "2027-02-30T12:01:00.000Z"]) {
        vi.stubEnv("PROFFERA_MARIA_DB_PROOF_EXPIRES_AT", expiry);
        expect((await GET(request())).status).toBe(404);
      }
      expect(mock.put).not.toHaveBeenCalled();
      for (const expiry of ["2027-03-02T12:01:00Z", "2027-03-02T12:01:00.000Z"]) {
        mock.markers.clear();
        vi.stubEnv("PROFFERA_MARIA_DB_PROOF_EXPIRES_AT", expiry);
        expect((await GET(request())).status).toBe(200);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires exact host, owner session, selected workspace and token", async () => {
    expect((await GET(request("wrong"))).status).toBe(404);
    expect((await GET(request(token, "https://makeupbymaria.se/api/maria-db-target-check"))).status).toBe(404);
    expect(mock.put).not.toHaveBeenCalled();
    for (const access of [
      { ok: false }, { ok: true, role: "staff", workspaceSlug: "makeup-by-maria" },
      { ok: true, role: "owner", workspaceSlug: "other-tenant" },
    ]) {
      mock.markers.clear(); // Each case represents a separate token/one-use window.
      mock.access.mockResolvedValueOnce(access);
      expect((await GET(request())).status).toBe(404);
    }
    expect(mock.connect).not.toHaveBeenCalled();
    expect(mock.put).toHaveBeenCalledTimes(3);
    expect(mock.access).toHaveBeenCalledWith({ suppressErrors: true });
  });

  it("rejects short or missing configuration tokens", async () => {
    vi.stubEnv("PROFFERA_MARIA_DB_PROOF_TOKEN", "short");
    expect((await GET(request("short"))).status).toBe(404);
    vi.stubEnv("PROFFERA_MARIA_DB_PROOF_TOKEN", undefined);
    expect((await GET(request())).status).toBe(404);
    expect(mock.connect).not.toHaveBeenCalled();
    expect(mock.put).not.toHaveBeenCalled();
  });

  it("refuses a different URL target or Neon/Vercel project hint before connecting", async () => {
    vi.stubEnv("DATABASE_URL", syntheticUrl.replace("ep-shy-forest", "ep-other"));
    expect((await GET(request())).status).toBe(404);
    expect((await GET(request())).status).toBe(404);
    mock.markers.clear();
    vi.stubEnv("DATABASE_URL", syntheticUrl);
    vi.stubEnv("NEON_PROJECT_ID", "wrong-project");
    expect((await GET(request())).status).toBe(404);
    mock.markers.clear();
    vi.stubEnv("NEON_PROJECT_ID", "late-water-28070748");
    vi.stubEnv("VERCEL_PROJECT_ID", "wrong-vercel-project");
    expect((await GET(request())).status).toBe(404);
    expect(mock.connect).not.toHaveBeenCalled();
    expect(mock.access).not.toHaveBeenCalled();
    expect(mock.put).toHaveBeenCalledTimes(4);
  });

  it("never falls back to another database when DATABASE_URL points elsewhere", async () => {
    vi.stubEnv("DATABASE_URL", syntheticUrl.replace("ep-shy-forest", "ep-wrong"));
    vi.stubEnv("POSTGRES_URL", syntheticUrl);
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(mock.connect).not.toHaveBeenCalled();
    expect(mock.access).not.toHaveBeenCalled();
    expect(mock.put).toHaveBeenCalledOnce();
  });

  it("fails closed if the shared marker store is missing or refuses the claim", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", undefined);
    expect((await GET(request())).status).toBe(404);
    expect(mock.put).not.toHaveBeenCalled();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "synthetic-blob-token");
    mock.put.mockRejectedValueOnce(new Error("store unavailable: secret details"));
    expect((await GET(request())).status).toBe(404);
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("consumes a valid token even if Owner validation throws", async () => {
    mock.access.mockRejectedValueOnce(new Error("sensitive database error"));
    expect((await GET(request())).status).toBe(404);
    expect((await GET(request())).status).toBe(404);
    expect(mock.access).toHaveBeenCalledOnce();
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("never probes after an uncertain claim acknowledgement", async () => {
    mock.put.mockImplementationOnce(async (pathname: string) => {
      mock.markers.add(pathname);
      throw new Error("response lost after store committed");
    });
    expect((await GET(request())).status).toBe(404);
    expect((await GET(request())).status).toBe(404);
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("denies a stalled Blob claim before the request budget and ignores a late success", async () => {
    vi.useFakeTimers();
    try {
      let finishClaim: (() => void) | undefined;
      mock.put.mockImplementationOnce(() => new Promise((resolve) => {
        finishClaim = () => resolve({ pathname: "late marker" });
      }));
      const response = GET(request());
      await vi.advanceTimersByTimeAsync(5_000);
      expect((await response).status).toBe(404);
      expect(mock.put.mock.calls[0][2].abortSignal.aborted).toBe(true);
      finishClaim?.();
      await Promise.resolve();
      expect(mock.access).not.toHaveBeenCalled();
      expect(mock.connect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses one SELECT in a READ ONLY transaction and returns only a boolean", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ targetVerified: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mock.put).toHaveBeenCalledWith(
      expect.stringMatching(/^internal\/maria-db-proof\/v1\/[0-9a-f]{64}\.txt$/),
      "consumed",
      { access: "public", addRandomSuffix: false, allowOverwrite: false, contentType: "text/plain",
        token: "synthetic-blob-token", abortSignal: expect.any(AbortSignal) },
    );
    expect(JSON.stringify(mock.put.mock.calls)).not.toContain(token);
    expect(mock.query.mock.calls.map(([sql]) => sql.trim())).toEqual([
      "BEGIN TRANSACTION READ ONLY",
      "SET LOCAL statement_timeout = '4s'",
      expect.stringContaining("select current_database()"),
      "ROLLBACK",
    ]);
    expect(mock.end).toHaveBeenCalledOnce();
    expect((await GET(request())).status).toBe(404);
    expect(mock.connect).toHaveBeenCalledOnce();
  });

  it("allows only one of two simultaneous authorized probes on different instances", async () => {
    const responses = await Promise.all([GET(request()), GET(request())]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 404]);
    expect(mock.put).toHaveBeenCalledTimes(2);
    expect(mock.connect).toHaveBeenCalledOnce();
  });

  it("fails closed on mismatched database or SQL error without echoing credentials", async () => {
    mock.query.mockImplementationOnce(async () => ({ rows: [] }))
      .mockImplementationOnce(async () => ({ rows: [] }))
      .mockImplementationOnce(async () => ({ rows: [{ ...probe, maria_workspace_count: 0 }] }))
      .mockImplementationOnce(async () => ({ rows: [] }));
    const mismatch = await GET(request());
    expect(mismatch.status).toBe(409);
    expect(await mismatch.json()).toEqual({ targetVerified: false });
    expect((await GET(request())).status).toBe(404);
    const secondToken = "d".repeat(64);
    vi.stubEnv("PROFFERA_MARIA_DB_PROOF_TOKEN", secondToken);
    mock.connect.mockRejectedValueOnce(new Error("postgresql://secret-user:secret-password@secret-host/hidden"));
    const failure = await GET(request(secondToken));
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({ targetVerified: false });
    expect(mock.end).toHaveBeenCalledTimes(2);
  });
});
