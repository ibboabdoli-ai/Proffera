import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const migrationFiles = [
  "20260820_0049_marketplace_guest_quotes.sql",
  "20260820_0050_marketplace_guest_dispatch_claim.sql",
  "20260820_0051_marketplace_guest_runtime_eligibility.sql",
  "20260821_0052_marketplace_guest_final_hardening.sql",
];
const migrations = migrationFiles.map((file) => readFileSync(join(process.cwd(), "db/migrations", file), "utf8"));

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function tokenHash(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

function pgError(error: unknown) {
  if (!error || typeof error !== "object") return { code: "", message: String(error ?? "") };
  const candidate = error as { code?: unknown; message?: unknown };
  return { code: String(candidate.code ?? ""), message: String(candidate.message ?? "") };
}

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("marketplace guest runtime PostgreSQL hardening", () => {
    let containerName = "";
    let connectionString = "";
    let client: Client;

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

    async function insertQuoteAndProfile(input?: {
      quoteStatus?: string;
      consent?: boolean;
      privacyBlocked?: boolean;
      publicationStatus?: string;
      isActive?: boolean;
      organizationKind?: string;
      claimedWorkspaceId?: string | null;
    }) {
      const quoteRequestId = randomUUID();
      const profileId = randomUUID();
      const workspaceId = input?.claimedWorkspaceId ?? null;
      if (workspaceId) await client.query("insert into workspaces (id) values ($1)", [workspaceId]);
      await client.query(
        "insert into quote_requests (id, status, consent_accepted) values ($1, $2, $3)",
        [quoteRequestId, input?.quoteStatus ?? "submitted", input?.consent ?? true],
      );
      await client.query(`
        insert into company_directory_profiles (
          id, publication_status, is_active, privacy_blocked, organization_kind, claimed_workspace_id
        ) values ($1, $2, $3, $4, $5, $6)
      `, [
        profileId,
        input?.publicationStatus ?? "published",
        input?.isActive ?? true,
        input?.privacyBlocked ?? false,
        input?.organizationKind ?? "juridical_person",
        workspaceId,
      ]);
      return { quoteRequestId, profileId };
    }

    async function insertInvitation(input: {
      quoteRequestId: string;
      profileId: string;
      status?: string;
      dispatchToken?: string | null;
      recipientEmail?: string;
      seed?: string;
      updatedAt?: Date;
      expiresAt?: Date;
    }) {
      const result = await client.query<{ id: string }>(`
        insert into marketplace_quote_invitations (
          quote_request_id, profile_id, recipient_email, token_hash, dispatch_token,
          status, wave, match_score, match_reasons, contact_basis, expires_at,
          created_by_admin_user_id, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, 1, 90, '[]'::jsonb,
          'manual_business_contact', $7, 'integration-test', $8
        ) returning id::text
      `, [
        input.quoteRequestId,
        input.profileId,
        input.recipientEmail ?? "offert@example.se",
        tokenHash(input.seed ?? randomUUID()),
        input.dispatchToken ?? null,
        input.status ?? "expired",
        input.expiresAt ?? new Date(Date.now() + 86_400_000),
        input.updatedAt ?? new Date(),
      ]);
      return String(result.rows[0]?.id ?? "");
    }

    beforeAll(async () => {
      containerName = `proffera-guest-runtime-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgres:16-alpine",
      ]);
      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/)[0] ?? "";
      const port = portLine.match(/:(\d+)$/)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);
      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();

      await client.query(`
        create extension if not exists pgcrypto;
        create table quote_requests (
          id uuid primary key,
          status text not null default 'submitted',
          consent_accepted boolean not null default true
        );
        create table workspaces (id uuid primary key);
        create table company_directory_profiles (
          id uuid primary key,
          publication_status text not null default 'published',
          is_active boolean not null default true,
          privacy_blocked boolean not null default false,
          organization_kind text not null default 'juridical_person',
          claimed_workspace_id uuid references workspaces(id) on delete set null
        );
      `);
      for (const migration of migrations) await client.query(migration);
    }, 120_000);

    beforeEach(async () => {
      await client.query(`
        truncate table marketplace_quote_offers,
          marketplace_outreach_suppressions,
          marketplace_quote_invitations,
          quote_requests,
          company_directory_profiles,
          workspaces cascade;
      `);
    });

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm may already have removed a failed container.
        }
      }
    }, 30_000);

    it("claims a valid provider dispatch and keeps the same ownership token", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId });
      const dispatchToken = randomUUID();

      await client.query(
        "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
        [invitationId, dispatchToken],
      );
      await client.query(
        "update marketplace_quote_invitations set status = 'pending' where id = $1 and dispatch_token = $2",
        [invitationId, dispatchToken],
      );
      const result = await client.query<{ status: string; dispatch_token: string }>(
        "select status, dispatch_token::text from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(result.rows[0]).toMatchObject({ status: "pending", dispatch_token: dispatchToken });
    });

    it("rejects a provider claim without a dispatch token", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId });
      let failure = { code: "", message: "" };
      try {
        await client.query("update marketplace_quote_invitations set status = 'sending' where id = $1", [invitationId]);
      } catch (error) {
        failure = pgError(error);
      }
      expect(failure.code).toBe("23514");
      expect(failure.message).toContain("marketplace_dispatch_token_required");
    });

    it("rejects dispatch for a closed quote or missing consent", async () => {
      for (const setup of [
        { quoteStatus: "cancelled", consent: true, expected: "marketplace_quote_closed" },
        { quoteStatus: "submitted", consent: false, expected: "marketplace_consent_required" },
      ]) {
        await client.query("truncate marketplace_quote_invitations, quote_requests, company_directory_profiles cascade");
        const { quoteRequestId, profileId } = await insertQuoteAndProfile(setup);
        const invitationId = await insertInvitation({ quoteRequestId, profileId });
        let failure = { code: "", message: "" };
        try {
          await client.query(
            "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
            [invitationId, randomUUID()],
          );
        } catch (error) {
          failure = pgError(error);
        }
        expect(failure.code).toBe("23514");
        expect(failure.message).toContain(setup.expected);
      }
    });

    it("rejects a suppressed recipient at the database boundary", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId, recipientEmail: "  Offert@Example.SE  " });
      await client.query(
        "insert into marketplace_outreach_suppressions (profile_id, email_normalized) values ($1, 'offert@example.se')",
        [profileId],
      );
      let failure = { code: "", message: "" };
      try {
        await client.query(
          "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
          [invitationId, randomUUID()],
        );
      } catch (error) {
        failure = pgError(error);
      }
      expect(failure.code).toBe("23514");
      expect(failure.message).toContain("marketplace_recipient_suppressed");
    });

    it("rechecks current profile eligibility before dispatch", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile({ privacyBlocked: true });
      const invitationId = await insertInvitation({ quoteRequestId, profileId });
      let failure = { code: "", message: "" };
      try {
        await client.query(
          "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
          [invitationId, randomUUID()],
        );
      } catch (error) {
        failure = pgError(error);
      }
      expect(failure.code).toBe("23514");
      expect(failure.message).toContain("marketplace_profile_ineligible");
    });

    it("revokes an active guest token when the company becomes ineligible", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const originalHash = tokenHash("known-active-token");
      const invitationId = await insertInvitation({ quoteRequestId, profileId, status: "sent", seed: "known-active-token" });

      await client.query("update company_directory_profiles set privacy_blocked = true where id = $1", [profileId]);
      const result = await client.query<{ status: string; token_hash: string; dispatch_token: string | null }>(
        "select status, token_hash, dispatch_token::text from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(result.rows[0]?.status).toBe("cancelled");
      expect(result.rows[0]?.token_hash).not.toBe(originalHash);
      expect(result.rows[0]?.dispatch_token).toBeNull();
      const oldToken = await client.query("select id from marketplace_quote_invitations where token_hash = $1", [originalHash]);
      expect(oldToken.rowCount).toBe(0);
    });

    it("rejects an offer when the linked company is currently ineligible", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile({ privacyBlocked: true });
      const invitationId = await insertInvitation({ quoteRequestId, profileId, status: "sent" });
      let failure = { code: "", message: "" };
      try {
        await client.query(`
          insert into marketplace_quote_offers (
            invitation_id, quote_request_id, profile_id, price_kind, amount_minor
          ) values ($1, $2, $3, 'estimate', 10000)
        `, [invitationId, quoteRequestId, profileId]);
      } catch (error) {
        failure = pgError(error);
      }
      expect(failure.code).toBe("23514");
      expect(failure.message).toContain("marketplace_profile_ineligible");
    });

    it("keeps an ambiguous provider claim non-retryable with its original identities", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const originalDispatchToken = randomUUID();
      const originalHash = tokenHash("ambiguous-token");
      const invitationId = await insertInvitation({
        quoteRequestId,
        profileId,
        status: "pending",
        dispatchToken: originalDispatchToken,
        seed: "ambiguous-token",
        updatedAt: new Date(Date.now() - 10 * 60_000),
      });

      await client.query("update marketplace_quote_invitations set status = 'delivery_failed' where id = $1", [invitationId]);
      let state = await client.query<{ status: string; token_hash: string; dispatch_token: string }>(
        "select status, token_hash, dispatch_token::text from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(state.rows[0]).toMatchObject({
        status: "delivery_uncertain",
        token_hash: originalHash,
        dispatch_token: originalDispatchToken,
      });

      await client.query(
        "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2, token_hash = $3 where id = $1",
        [invitationId, randomUUID(), tokenHash("replacement-token")],
      );
      state = await client.query(
        "select status, token_hash, dispatch_token::text from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(state.rows[0]).toMatchObject({
        status: "delivery_uncertain",
        token_hash: originalHash,
        dispatch_token: originalDispatchToken,
      });
    });

    it("rejects mutation of a fresh active dispatch ownership token", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId });
      const originalDispatchToken = randomUUID();
      await client.query(
        "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
        [invitationId, originalDispatchToken],
      );

      let failure = { code: "", message: "" };
      try {
        await client.query(
          "update marketplace_quote_invitations set dispatch_token = $2 where id = $1",
          [invitationId, randomUUID()],
        );
      } catch (error) {
        failure = pgError(error);
      }
      expect(failure.code).toBe("23514");
      expect(failure.message).toContain("marketplace_active_dispatch_token_immutable");
    });

    it("uses the normalized recipient expression in the final index", async () => {
      const result = await client.query<{ indexdef: string }>(`
        select indexdef
        from pg_indexes
        where indexname = 'marketplace_quote_invitations_recipient_idx'
      `);
      expect(result.rows[0]?.indexdef).toContain("lower(btrim(recipient_email))");
    });

    it("serializes opt-out before provider claim so suppression wins", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId, recipientEmail: "offert@race.se" });
      const suppressor = new Client({ connectionString });
      const dispatcher = new Client({ connectionString });
      await suppressor.connect();
      await dispatcher.connect();
      try {
        await suppressor.query("begin");
        await suppressor.query(
          "insert into marketplace_outreach_suppressions (profile_id, email_normalized, source_invitation_id) values ($1, 'offert@race.se', $2)",
          [profileId, invitationId],
        );

        const dispatchPromise = dispatcher.query(
          "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
          [invitationId, randomUUID()],
        ).then(
          () => ({ ok: true as const, code: "", message: "" }),
          (error) => ({ ok: false as const, ...pgError(error) }),
        );

        await delay(150);
        await suppressor.query("commit");
        const dispatch = await dispatchPromise;
        expect(dispatch.ok).toBe(false);
        expect(dispatch.code).toBe("23514");
        expect(dispatch.message).toContain("marketplace_recipient_suppressed");
      } finally {
        await suppressor.query("rollback").catch(() => undefined);
        await suppressor.end();
        await dispatcher.end();
      }
    });
  });
} else {
  describe("marketplace guest runtime PostgreSQL hardening", () => {
    it("runs the database-backed suite in CI or when explicitly enabled", () => {
      expect(RUN_POSTGRES_INTEGRATION).toBe(false);
      expect(migrations).toHaveLength(4);
    });
  });
}
