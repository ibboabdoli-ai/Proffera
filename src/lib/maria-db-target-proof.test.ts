import { describe, expect, it } from "vitest";
import { matchesMariaProductionDatabaseUrl, summarizeMariaProof } from "./maria-db-target-proof";

const good = "postgresql://fake-user:fake-secret@ep-shy-forest-aduyugb7.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
const row = { database_name: "neondb", transaction_read_only: true, maria_workspace_count: 1 };

describe("Maria DB destination proof (synthetic only)", () => {
  it("matches only the exact Neon endpoint and database, including the Neon pooler", () => {
    expect(matchesMariaProductionDatabaseUrl(good)).toBe(true);
    expect(matchesMariaProductionDatabaseUrl(good.replace("ep-shy-forest-aduyugb7.", "ep-shy-forest-aduyugb7-pooler."))).toBe(true);
    expect(matchesMariaProductionDatabaseUrl(good.replace("/neondb", "/other"))).toBe(false);
    expect(matchesMariaProductionDatabaseUrl(good.replace("ep-shy-forest", "ep-unknown"))).toBe(false);
    expect(matchesMariaProductionDatabaseUrl(good.replace("postgresql:", "https:"))).toBe(false);
    expect(matchesMariaProductionDatabaseUrl(good.replace("/neondb", ":5433/neondb"))).toBe(false);
    expect(matchesMariaProductionDatabaseUrl(good.replace("sslmode=require", "sslmode=disable"))).toBe(false);
    expect(matchesMariaProductionDatabaseUrl(good.replace("?sslmode=require", ""))).toBe(false);
    expect(matchesMariaProductionDatabaseUrl("invalid url")).toBe(false);
    expect(matchesMariaProductionDatabaseUrl(null)).toBe(false);
  });

  it("checks live database name, owner workspace and read-only transaction", () => {
    expect(summarizeMariaProof(true, row, true)).toEqual({ targetVerified: true });
    expect(summarizeMariaProof(false, row, true).targetVerified).toBe(false);
    expect(summarizeMariaProof(true, row, false).targetVerified).toBe(false);
    expect(summarizeMariaProof(true, { ...row, database_name: "other" }, true).targetVerified).toBe(false);
    expect(summarizeMariaProof(true, { ...row, transaction_read_only: false }, true).targetVerified).toBe(false);
    expect(summarizeMariaProof(true, { ...row, maria_workspace_count: 2 }, true).targetVerified).toBe(false);
    expect(summarizeMariaProof(true, { ...row, maria_workspace_count: 0 }, true).targetVerified).toBe(false);
  });

  it("returns only the match result, never an endpoint, password or customer counts", () => {
    const result = summarizeMariaProof(matchesMariaProductionDatabaseUrl(good), row, true);
    expect(Object.keys(result)).toEqual(["targetVerified"]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("fake-secret");
    expect(serialized).not.toContain("ep-shy-forest-aduyugb7");
    expect(serialized).not.toContain("neondb");
    expect(serialized).not.toContain("maria_workspace_count");
  });
});
