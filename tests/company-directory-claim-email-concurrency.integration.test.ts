import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

const RUN_POSTGRES_INTEGRATION = process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const USER_ID = "user-1";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const SLUG = "race-company";
const ACCOUNT_EMAIL = "owner@race-company.se";

type QueryHook = (query: string, values: unknown[]) => void | Promise<void>;

type SqlHooks = {
  before?: QueryHook;
  after?: QueryHook;
};

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function normalizeSql(query: string) {
  return query.replace(/\s+/gu, " ").trim().toLowerCase();
}

function postgresSql(client: Client, hooks: SqlHooks = {}) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    const normalized = normalizeSql(query);
    await hooks.before?.(normalized, values);
    const result = await client.query(query, values);
    await hooks.after?.(normalized, values);
    return result.rows;
  };
}

const sqlContext = new AsyncLocalStorage<ReturnType<typeof postgresSql>>();

function withSql<T>(sql: ReturnType<typeof postgresSql>, action: () => Promise<T>) {
  return sqlContext.run(sql, action);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function isVerificationRead(query: string) {
  return query.startsWith("select claim.id::text")
    && query.includes('join "user" u on u.id = claim.claimant_user_id');
}

function isEvidenceCas(query: string) {
  return query.startsWith("update company_directory_claims")
    && query.includes("and verification_reference = $")
    && query.includes("returning id::text");
}

function isResetEvidenceRead(query: string) {
  return query.startsWith("select id::text, status, verification_method, verification_reference");
}

function isResetCas(query: string) {
  return query.startsWith("update company_directory_claims")
    && query.includes("set status = 'cancelled'")
    && query.includes("and verification_reference = $");
}

function verifyRequest(code: string, slug = SLUG) {
  const form = new FormData();
  form.set("slug", slug);
  form.set("code", code);
  form.set("returnTo", `/foretag/claim/${slug}`);
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
  if (!location) return null;
  return new URL(location).searchParams.get("status");
}

function wrongCodeFor(code: string) {
  return code === "000000" ? "111111" : "000000";
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "company claim email verification concurrency PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let control: Client | null = null;

    async function waitForPostgres() {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const probe = new Client({ connectionString });
        try {
          await probe.connect();
          await probe.query("select 1");
          await probe.end();
          return;
        } catch (error) {
          lastError = error;
          await probe.end().catch(() => undefined);
          await delay(500);
        }
      }
      throw lastError ?? new Error("PostgreSQL test container did not become ready");
    }

    async function requestClient(applicationName: string) {
      const client = new Client({ connectionString, application_name: applicationName });
      await client.connect();
      return client;
    }

    async function seedChallenge() {
      const challenge = createClaimEmailChallenge({
        claimantName: "Race Owner",
        role: "Owner",
        businessEmail: ACCOUNT_EMAIL,
        phone: "0700000000",
        accountEmail: ACCOUNT_EMAIL,
      });
      await control!.query(`
        insert into company_directory_claims (
          id, profile_id, claimant_user_id, requested_workspace_id,
          status, verification_method, verification_reference, requested_at
        ) values ($1::uuid, $2::uuid, $3, null, 'pending', 'email_domain', $4, now())
      `, [CLAIM_ID, PROFILE_ID, USER_ID, serializeClaimEmailEvidence(challenge.evidence)]);
      return challenge;
    }

    async function currentClaim() {
      const rows = await control!.query<{ status: string; verification_reference: string }>(`
        select status, verification_reference
        from company_directory_claims
        where id = $1::uuid
      `, [CLAIM_ID]);
      const row = rows.rows[0];
      return {
        status: row?.status ?? "",
        reference: row?.verification_reference ?? "",
        evidence: parseClaimEmailEvidence(row?.verification_reference),
      };
    }

    beforeAll(async () => {
      containerName = `proffera-claim-email-race-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgres:16-alpine",
      ]);

      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
      const port = portLine.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);

      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      control = await requestClient("proffera-claim-email-race-control");

      await control.query(`
        create table workspaces (
          id uuid primary key
        );
        create table "user" (
          id text primary key,
          email text not null
        );
      `);
      await control.query(readFileSync(
        new URL("../db/migrations/20260809_0037_company_profile_engine_foundation.sql", import.meta.url),
        "utf8",
      ));
      await control.query(readFileSync(
        new URL("../db/migrations/20260809_0040_company_profile_claim_reservation.sql", import.meta.url),
        "utf8",
      ));
    }, 120_000);

    afterAll(async () => {
      await control?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm can remove a failed container before cleanup.
        }
      }
    }, 30_000);

    beforeEach(async () => {
      for (const mock of Object.values(mocks)) mock.mockReset();
      mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
      mocks.getSql.mockImplementation(() => sqlContext.getStore() ?? null);
      mocks.allowPublicSubmission.mockResolvedValue(true);
      mocks.tryAutoProvisionMarketplaceCompanyClaim.mockResolvedValue({ status: "not_eligible" });
      mocks.getUserWorkspaceAccess.mockResolvedValue({ ok: false });
      mocks.canManageWorkspaceSettings.mockReturnValue(false);

      await control!.query("truncate table company_directory_claims, company_directory_profiles, \"user\" cascade");
      await control!.query("insert into \"user\" (id, email) values ($1, $2)", [USER_ID, ACCOUNT_EMAIL]);
      await control!.query(`
        insert into company_directory_profiles (
          id, country_code, organization_number, organization_kind, legal_name, display_name,
          is_active, category_slug, city, public_slug, publication_status, quality_score,
          privacy_blocked, auto_public_eligible
        ) values (
          $1::uuid, 'SE', '5560000000', 'juridical_person', 'Race Company AB', 'Race Company AB',
          true, 'fonsterputsning', 'Stockholm', $2, 'published', 100, false, true
        )
      `, [PROFILE_ID, SLUG]);
    });

    it("keeps a successful verification consumed when a stale failed request writes afterward", async () => {
      const challenge = await seedChallenge();
      const wrongCode = wrongCodeFor(challenge.code);
      const clientA = await requestClient("proffera-claim-email-success-a");
      const clientB = await requestClient("proffera-claim-email-failure-b");
      const bothRead = deferred();
      const aWriteDone = deferred();
      let reads = 0;
      let aInitialRead = true;
      let bInitialRead = true;

      const hooks = (label: "a" | "b"): SqlHooks => ({
        before: async (query) => {
          if (!isEvidenceCas(query)) return;
          await bothRead.promise;
          if (label === "b") await aWriteDone.promise;
        },
        after: async (query) => {
          if (isVerificationRead(query)) {
            const initial = label === "a" ? aInitialRead : bInitialRead;
            if (initial) {
              if (label === "a") aInitialRead = false;
              else bInitialRead = false;
              reads += 1;
              if (reads === 2) bothRead.resolve();
            }
          }
          if (label === "a" && isEvidenceCas(query)) aWriteDone.resolve();
        },
      });

      try {
        const [success, staleFailure] = await Promise.all([
          withSql(postgresSql(clientA, hooks("a")), () => verifyClaimEmail(verifyRequest(challenge.code))),
          withSql(postgresSql(clientB, hooks("b")), () => verifyClaimEmail(verifyRequest(wrongCode))),
        ]);

        expect(responseStatus(success)).toBe("sent");
        expect(responseStatus(staleFailure)).toBe("sent");
        const claim = await currentClaim();
        expect(claim.status).toBe("pending");
        expect(claim.evidence?.stage).toBe("business_email_verified");
        expect(claim.evidence?.businessEmailVerifiedAt).toBeTruthy();
        expect(claim.evidence?.codeHash).toBeUndefined();
        expect(claim.evidence?.codeSalt).toBeUndefined();
        expect(claim.evidence?.codeExpiresAt).toBeUndefined();
      } finally {
        await Promise.all([clientA.end(), clientB.end()]);
      }
    });

    it("re-evaluates a stale failed attempt so concurrent failures are not lost", async () => {
      const challenge = await seedChallenge();
      const wrongCode = wrongCodeFor(challenge.code);
      const clientA = await requestClient("proffera-claim-email-failure-a");
      const clientB = await requestClient("proffera-claim-email-failure-b");
      const bothRead = deferred();
      const aWriteDone = deferred();
      let reads = 0;
      let aInitialRead = true;
      let bInitialRead = true;

      const hooks = (label: "a" | "b"): SqlHooks => ({
        before: async (query) => {
          if (!isEvidenceCas(query)) return;
          await bothRead.promise;
          if (label === "b") await aWriteDone.promise;
        },
        after: async (query) => {
          if (isVerificationRead(query)) {
            const initial = label === "a" ? aInitialRead : bInitialRead;
            if (initial) {
              if (label === "a") aInitialRead = false;
              else bInitialRead = false;
              reads += 1;
              if (reads === 2) bothRead.resolve();
            }
          }
          if (label === "a" && isEvidenceCas(query)) aWriteDone.resolve();
        },
      });

      try {
        const [failureA, failureB] = await Promise.all([
          withSql(postgresSql(clientA, hooks("a")), () => verifyClaimEmail(verifyRequest(wrongCode))),
          withSql(postgresSql(clientB, hooks("b")), () => verifyClaimEmail(verifyRequest(wrongCode))),
        ]);

        expect(responseStatus(failureA)).toBe("email_code_invalid");
        expect(responseStatus(failureB)).toBe("email_code_invalid");
        const claim = await currentClaim();
        expect(claim.evidence?.stage).toBe("business_email_code_sent");
        expect(claim.evidence?.codeAttempts).toBe(2);
      } finally {
        await Promise.all([clientA.end(), clientB.end()]);
      }
    });

    it("cannot verify stale evidence after a resend replaces the challenge", async () => {
      const original = await seedChallenge();
      let replacement = createClaimEmailChallenge({
        claimantName: "Race Owner",
        role: "Owner",
        businessEmail: ACCOUNT_EMAIL,
        phone: "0700000000",
        accountEmail: ACCOUNT_EMAIL,
      });
      while (replacement.code === original.code) {
        replacement = createClaimEmailChallenge({
          claimantName: "Race Owner",
          role: "Owner",
          businessEmail: ACCOUNT_EMAIL,
          phone: "0700000000",
          accountEmail: ACCOUNT_EMAIL,
        });
      }

      const requestDb = await requestClient("proffera-claim-email-stale-success");
      const initialRead = deferred();
      const replacementPersisted = deferred();
      let sawInitialRead = false;
      const hooks: SqlHooks = {
        before: async (query) => {
          if (isEvidenceCas(query)) await replacementPersisted.promise;
        },
        after: async (query) => {
          if (isVerificationRead(query) && !sawInitialRead) {
            sawInitialRead = true;
            initialRead.resolve();
          }
        },
      };

      try {
        const pending = withSql(
          postgresSql(requestDb, hooks),
          () => verifyClaimEmail(verifyRequest(original.code)),
        );
        await initialRead.promise;
        await control!.query(`
          update company_directory_claims
          set verification_reference = $1, requested_at = now()
          where id = $2::uuid
        `, [serializeClaimEmailEvidence(replacement.evidence), CLAIM_ID]);
        replacementPersisted.resolve();

        const response = await pending;
        expect(responseStatus(response)).toBe("email_code_invalid");
        const claim = await currentClaim();
        expect(claim.evidence?.stage).toBe("business_email_code_sent");
        expect(claim.evidence?.businessEmailVerifiedAt).toBeUndefined();
        expect(claim.evidence?.codeAttempts).toBe(1);
        expect(claim.evidence?.codeHash).toBe(replacement.evidence.codeHash);
        expect(claim.evidence?.codeSalt).toBe(replacement.evidence.codeSalt);
      } finally {
        await requestDb.end();
      }
    });

    it("keeps the normal single-request successful verification behavior", async () => {
      const challenge = await seedChallenge();
      const requestDb = await requestClient("proffera-claim-email-happy-path");
      try {
        const response = await withSql(
          postgresSql(requestDb),
          () => verifyClaimEmail(verifyRequest(challenge.code)),
        );
        expect(responseStatus(response)).toBe("sent");
        const claim = await currentClaim();
        expect(claim.evidence?.stage).toBe("business_email_verified");
        expect(claim.evidence?.codeAttempts).toBe(0);
        expect(claim.evidence?.codeHash).toBeUndefined();
        expect(mocks.tryAutoProvisionMarketplaceCompanyClaim).toHaveBeenCalledWith({
          claimId: CLAIM_ID,
          claimantUserId: USER_ID,
        });
      } finally {
        await requestDb.end();
      }
    });

    it("keeps wrong-user and wrong-claim verification fail-closed", async () => {
      const challenge = await seedChallenge();
      const before = await currentClaim();
      const requestDb = await requestClient("proffera-claim-email-auth-negative");
      try {
        mocks.getServerSession.mockResolvedValueOnce({ user: { id: "different-user" } });
        const wrongUser = await withSql(
          postgresSql(requestDb),
          () => verifyClaimEmail(verifyRequest(challenge.code)),
        );
        expect(responseStatus(wrongUser)).toBe("invalid_details");

        mocks.getServerSession.mockResolvedValueOnce({ user: { id: USER_ID } });
        const wrongClaim = await withSql(
          postgresSql(requestDb),
          () => verifyClaimEmail(verifyRequest(challenge.code, "different-company")),
        );
        expect(responseStatus(wrongClaim)).toBe("invalid_details");

        const after = await currentClaim();
        expect(after.reference).toBe(before.reference);
        expect(after.evidence?.stage).toBe("business_email_code_sent");
        expect(after.evidence?.codeAttempts).toBe(0);
      } finally {
        await requestDb.end();
      }
    });

    it("does not let a stale reset cancel evidence that verify just consumed", async () => {
      const challenge = await seedChallenge();
      const resetDb = await requestClient("proffera-claim-email-reset-race");
      const verifyDb = await requestClient("proffera-claim-email-reset-race-verify");
      const resetRead = deferred();
      const verifyDone = deferred();
      let sawResetRead = false;
      const resetHooks: SqlHooks = {
        before: async (query) => {
          if (isResetCas(query)) await verifyDone.promise;
        },
        after: async (query) => {
          if (isResetEvidenceRead(query) && !sawResetRead) {
            sawResetRead = true;
            resetRead.resolve();
          }
        },
      };

      try {
        const pendingReset = withSql(
          postgresSql(resetDb, resetHooks),
          () => resetOrSendClaimEmail(resetRequest()),
        );
        await resetRead.promise;
        const verifiedResponse = await withSql(
          postgresSql(verifyDb),
          () => verifyClaimEmail(verifyRequest(challenge.code)),
        );
        expect(responseStatus(verifiedResponse)).toBe("sent");
        verifyDone.resolve();

        const resetResponse = await pendingReset;
        expect(responseStatus(resetResponse)).toBe("unavailable");
        const claim = await currentClaim();
        expect(claim.status).toBe("pending");
        expect(claim.evidence?.stage).toBe("business_email_verified");
        expect(claim.evidence?.codeHash).toBeUndefined();
      } finally {
        await Promise.all([resetDb.end(), verifyDb.end()]);
      }
    });

    it("rejects unauthenticated verification before any database mutation", async () => {
      mocks.getServerSession.mockResolvedValue(null);
      const response = await verifyClaimEmail(verifyRequest("123456"));
      expect(new URL(response.headers.get("location") ?? "http://localhost").pathname).toBe("/logga-in");
      expect(mocks.getSql).not.toHaveBeenCalled();
    });
  },
);
