import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));

import { approveSoleTraderDirectoryClaim } from "../src/lib/company-directory-sole-trader-owner";

const CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("sole-trader approval SQL contract", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.getPlatformAdmin.mockReset();
  });

  it("executes approval with a typed claim id in the audit json payload", async () => {
    mocks.getPlatformAdmin.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
    let capturedSql = "";
    let capturedValues: unknown[] = [];
    const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      capturedSql = strings.join("?");
      capturedValues = values;
      return Promise.resolve([{ id: CLAIM_ID, workspace_id: WORKSPACE_ID }]);
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(approveSoleTraderDirectoryClaim({
      claimId: CLAIM_ID,
      reference: "Innehavarskap kontrollerat mot Bolagsverket",
    })).resolves.toEqual({ claimId: CLAIM_ID, workspaceId: WORKSPACE_ID });

    expect(capturedSql).toContain("jsonb_build_object(");
    expect(capturedSql).toContain("'claimId', ?::text");
    expect(capturedSql).toContain("'status', 'claimed'");

    const claimParameterPosition = capturedSql.indexOf("'claimId', ?::text");
    expect(claimParameterPosition).toBeGreaterThan(-1);
    const parametersBeforeClaimId = (capturedSql.slice(0, claimParameterPosition).match(/\?/g) ?? []).length;
    expect(capturedValues[parametersBeforeClaimId]).toBe(CLAIM_ID);
  });

  it("keeps a supplementary source guard against the untyped audit parameter", () => {
    const approvalSource = source("src/lib/company-directory-sole-trader-owner.ts");

    expect(approvalSource).toContain("'claimId', ${claimId}::text");
    expect(approvalSource).not.toContain("'claimId', ${claimId},\n          'status', 'claimed'");
  });
});
