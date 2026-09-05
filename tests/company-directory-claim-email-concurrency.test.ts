import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getSql: vi.fn(),
  allowPublicSubmission: vi.fn(),
  tryAutoProvisionMarketplaceCompanyClaim: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-session", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/public-form-protection", () => ({ allowPublicSubmission: mocks.allowPublicSubmission }));
vi.mock("@/lib/company-directory-marketplace-claim", () => ({
  tryAutoProvisionMarketplaceCompanyClaim: mocks.tryAutoProvisionMarketplaceCompanyClaim,
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));

import {
  createClaimEmailChallenge,
  parseClaimEmailEvidence,
  serializeClaimEmailEvidence,
} from "../src/lib/company-directory-claim-email";
import { POST as resetOrSendClaimEmail } from "../src/app/api/public-directory/claim-email/send/route";
import { POST as verifyClaimEmail } from "../src/app/api/public-directory/claim-email/verify/route";

const USER_ID = "user-1";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const SLUG = "race-company";
const ACCOUNT_EMAIL = "owner@race-company.se";

type SqlCall = {
  query: string;
  values: unknown[];
};

type SqlHandler = (query: string, values: unknown[]) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>;

function normalizeSql(query: string) {
  return query.replace(/\s+/gu, " ").trim().toLowerCase();
}

function recordingSql(handler: SqlHandler) {
  const calls: SqlCall[] = [];
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    const normalized = normalizeSql(query);
    calls.push({ query: normalized, values });
    return handler(normalized, values);
  };
  return { calls, sql };
}

function challenge() {
  return createClaimEmailChallenge({
    claimantName: "Race Owner",
    role: "Owner",
    businessEmail: ACCOUNT_EMAIL,
    phone: "0700000000",
    accountEmail: ACCOUNT_EMAIL,
  });
}

function verificationRow(reference: string) {
  return {
    id: CLAIM_ID,
    status: "pending",
    verification_method: "email_domain",
    verification_reference: reference,
    claimed_workspace_id: null,
    claim_reservation_id: null,
    account_email: ACCOUNT_EMAIL,
  };
}

function verifyRequest(code: string) {
  const form = new FormData();
  form.set("slug", SLUG);
  form.set("code", code);
  form.set("returnTo", `/foretag/claim/${SLUG}`);
  return new Request("http://localhost/api/public-directory/claim-email/verify", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: form,
  });
}

function resetRequest() {
  const form = new FormData();
  form.set("slug", SLUG);
  form.set("action", "reset");
  form.set("returnTo", `/foretag/claim/${SLUG}`);
  return new Request("http://localhost/api/public-directory/claim-email/send", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: form,
  });
}

function responseStatus(response: Response) {
  const location = response.headers.get("location");
  return location ? new URL(location).searchParams.get("status") : null;
}

function wrongCodeFor(code: string) {
  return code === "000000" ? "111111" : "000000";
}

describe("company directory claim email concurrency guards", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.allowPublicSubmission.mockResolvedValue(true);
    mocks.tryAutoProvisionMarketplaceCompanyClaim.mockResolvedValue({ status: "not_eligible" });
    mocks.getUserWorkspaceAccess.mockResolvedValue({ ok: false });
    mocks.canManageWorkspaceSettings.mockReturnValue(false);
  });

  it("re-reads and retries verification after a stale evidence compare-and-swap", async () => {
    const seeded = challenge();
    const reference = serializeClaimEmailEvidence(seeded.evidence);
    let verificationReads = 0;
    let casAttempts = 0;
    const { calls, sql } = recordingSql((query) => {
      if (query.startsWith("select claim.id::text")) {
        verificationReads += 1;
        return [verificationRow(reference)];
      }
      if (query.startsWith("update company_directory_claims")) {
        casAttempts += 1;
        return casAttempts === 1 ? [] : [{ id: CLAIM_ID }];
      }
      throw new Error(`Unexpected SQL in verify concurrency test: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    const response = await verifyClaimEmail(verifyRequest(wrongCodeFor(seeded.code)));

    expect(responseStatus(response)).toBe("email_code_invalid");
    expect(verificationReads).toBe(2);
    expect(casAttempts).toBe(2);
    const casCalls = calls.filter((call) => call.query.startsWith("update company_directory_claims"));
    expect(casCalls).toHaveLength(2);
    for (const call of casCalls) {
      expect(call.query).toContain("and verification_reference = $");
      expect(call.query).toContain("returning id::text");
      expect(call.values.at(-1)).toBe(reference);
    }
    const verificationReadCalls = calls.filter((call) => call.query.startsWith("select claim.id::text"));
    expect(verificationReadCalls[1]?.query).toContain("where claim.id = $1::uuid");
  });

  it("fails closed after the bounded stale-evidence retry limit without overwriting the latest evidence", async () => {
    const seeded = challenge();
    let currentReference = serializeClaimEmailEvidence(seeded.evidence);
    let verificationReads = 0;
    let casAttempts = 0;
    const { sql } = recordingSql((query) => {
      if (query.startsWith("select claim.id::text")) {
        verificationReads += 1;
        return [verificationRow(currentReference)];
      }
      if (query.startsWith("update company_directory_claims")) {
        casAttempts += 1;
        const latest = parseClaimEmailEvidence(currentReference);
        if (!latest) throw new Error("Expected current claim email evidence");
        currentReference = serializeClaimEmailEvidence({
          ...latest,
          providerId: `concurrent-writer-${casAttempts}`,
        });
        return [];
      }
      throw new Error(`Unexpected SQL in retry-limit concurrency test: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    const response = await verifyClaimEmail(verifyRequest(wrongCodeFor(seeded.code)));

    expect(responseStatus(response)).toBe("unavailable");
    expect(casAttempts).toBe(6);
    expect(verificationReads).toBe(6);
    const latest = parseClaimEmailEvidence(currentReference);
    expect(latest?.providerId).toBe("concurrent-writer-6");
    expect(latest?.codeAttempts).toBe(0);
  });

  it("returns unavailable when a stale reset loses its evidence compare-and-swap", async () => {
    const seeded = challenge();
    const reference = serializeClaimEmailEvidence(seeded.evidence);
    const { calls, sql } = recordingSql((query) => {
      if (query.startsWith("select id::text, display_name")) {
        return [{
          id: PROFILE_ID,
          display_name: "Race Company AB",
          claimed_workspace_id: null,
          claim_reservation_id: null,
        }];
      }
      if (query.startsWith('select email from "user"')) {
        return [{ email: ACCOUNT_EMAIL }];
      }
      if (query.startsWith("select id::text, status, verification_method, verification_reference")) {
        return [{
          id: CLAIM_ID,
          status: "pending",
          verification_method: "email_domain",
          verification_reference: reference,
          requested_workspace_id: null,
        }];
      }
      if (query.startsWith("update company_directory_claims") && query.includes("set status = 'cancelled'")) {
        return [];
      }
      throw new Error(`Unexpected SQL in reset concurrency test: ${query}`);
    });
    mocks.getSql.mockReturnValue(sql);

    const response = await resetOrSendClaimEmail(resetRequest());

    expect(responseStatus(response)).toBe("unavailable");
    const resetCalls = calls.filter((call) => call.query.includes("set status = 'cancelled'"));
    expect(resetCalls).toHaveLength(1);
    expect(resetCalls[0]?.query).toContain("and verification_reference = $");
    expect(resetCalls[0]?.query).toContain('verification_reference not like \'%"stage":"business_email_verified"%\'');
    expect(resetCalls[0]?.query).toContain("returning id::text");
    expect(resetCalls[0]?.values.at(-1)).toBe(reference);
  });
});
