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
  "20260821_0053_marketplace_guest_recipient_index.sql",
] as const;
const migrations = migrationFiles.map((file) => ({
  file,
  sql: readFileSync(join(process.cwd(), "db/migrations", file), "utf8"),
}));
const productionBaseline = readFileSync(
  join(process.cwd(), "tests/fixtures/marketplace-guest-production-baseline.sql"),
  "utf8",
);

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

async function applyMigrationFile(client: Client, file: string, sql: string) {
  if (!file.endsWith("0053_marketplace_guest_recipient_index.sql")) {
    await client.query(sql);
    return;
  }

  // 0053 is intentionally non-transactional because PostgreSQL forbids
  // CREATE/DROP INDEX CONCURRENTLY inside a transaction block. Execute its two
  // statements independently, exactly as the production deployment note requires.
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^--[^\n]*$/u.test(statement));
  for (const statement of statements) await client.query(statement);
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
      if (workspaceId) {
        await client.query(
          "insert into workspaces (id, slug, name) values ($1, $2, $3)",
          [workspaceId, `workspace-${workspaceId}`, "Integration Workspace"],
        );
      }

      await client.query(`
        insert into quote_requests (
          id, category, service_type, city, postal_code, description,
          preferred_date, contact_name, contact_email, contact_phone,
          consent_accepted, status, reference_id
        ) values (
          $1, 'vvs', 'Rörmokare', 'Södertälje', '15100', 'Integration test request',
          '', 'Test Customer', 'customer@example.test', '0700000000',
          $2, $3, $4
        )
      `, [quoteRequestId, input?.consent ?? true, input?.quoteStatus ?? "submitted", `PF-${quoteRequestId}`]);

      const publicationStatus = input?.publicationStatus ?? "published";
      const isActive = input?.isActive ?? true;
      const privacyBlocked = input?.privacyBlocked ?? false;
      await client.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          is_active, category_slug, city, municipality, public_slug,
          publication_status, quality_score, privacy_blocked, auto_public_eligible,
          claimed_workspace_id
        ) values (
          $1, $2, $3, 'Integration Företag AB', 'Integration Företag AB',
          $4, 'vvs', 'Södertälje', 'Södertälje', $5,
          $6, 95, $7, true, $8
        )
      `, [
        profileId,
        profileId.replace(/-/g, "").slice(0, 10),
        input?.organizationKind ?? "juridical_person",
        isActive,
        `profile-${profileId}`,
        publicationStatus,
        privacyBlocked,
        workspaceId,
      ]);
      return { quoteRequestId, profileId };
    }

    async function insertInvitation(input: {
      quoteRequestId: string;
      profileId: string;
      status?: string;
      dispatchToken?: string | null;
      providerClaimedAt?: Date | null;
      recipientEmail?: string;
      seed?: string;
      updatedAt?: Date;
      expiresAt?: Date;
    }) {
      const result = await client.query<{ id: string }>(`
        insert into marketplace_quote_invitations (
          quote_request_id, profile_id, recipient_email, token_hash, dispatch_token,
          provider_claimed_at, status, wave, match_score, match_reasons, contact_basis,
          expires_at, created_by_admin_user_id, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, 1, 90, '[]'::jsonb,
          'manual_business_contact', $8, 'integration-test', $9
        ) returning id::text
      `, [
        input.quoteRequestId,
        input.profileId,
        input.recipientEmail ?? "offert@example.se",
        tokenHash(input.seed ?? randomUUID()),
        input.dispatchToken ?? null,
        input.providerClaimedAt ?? null,
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

      await client.query(productionBaseline);
      for (const migration of migrations) {
        await applyMigrationFile(client, migration.file, migration.sql);
      }
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

    it("claims a valid provider dispatch and records the provider boundary", async () => {
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
      const result = await client.query<{ status: string; dispatch_token: string; provider_claimed_at: Date | null }>(
        "select status, dispatch_token::text, provider_claimed_at from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(result.rows[0]?.status).toBe("pending");
      expect(result.rows[0]?.dispatch_token).toBe(dispatchToken);
      expect(result.rows[0]?.provider_claimed_at).toBeInstanceOf(Date);
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
      const { quoteRequestId, profileId } = await insertQuoteAndProfile({
        publicationStatus: "blocked",
        privacyBlocked: true,
      });
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

      await client.query(
        "update company_directory_profiles set publication_status = 'blocked', privacy_blocked = true where id = $1",
        [profileId],
      );
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
      const { quoteRequestId, profileId } = await insertQuoteAndProfile({ publicationStatus: "blocked" });
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

    it("turns a stale provider-claimed pending retry into delivery_uncertain and preserves identities", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const originalDispatchToken = randomUUID();
      const originalHash = tokenHash("stale-pending-token");
      const originalExpiresAt = new Date(Date.now() + 3_600_000);
      const invitationId = await insertInvitation({
        quoteRequestId,
        profileId,
        status: "pending",
        dispatchToken: originalDispatchToken,
        providerClaimedAt: new Date(Date.now() - 10 * 60_000),
        seed: "stale-pending-token",
        updatedAt: new Date(Date.now() - 10 * 60_000),
        expiresAt: originalExpiresAt,
      });

      await client.query(
        "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2, token_hash = $3 where id = $1",
        [invitationId, randomUUID(), tokenHash("replacement-token")],
      );
      const state = await client.query<{
        status: string;
        token_hash: string;
        dispatch_token: string;
        expires_at: Date;
      }>(
        "select status, token_hash, dispatch_token::text, expires_at from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(state.rows[0]?.status).toBe("delivery_uncertain");
      expect(state.rows[0]?.token_hash).toBe(originalHash);
      expect(state.rows[0]?.dispatch_token).toBe(originalDispatchToken);
      expect(state.rows[0]?.expires_at.getTime()).toBe(originalExpiresAt.getTime());
    });

    it("keeps a provider-claimed delivery failure non-retryable", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const originalDispatchToken = randomUUID();
      const originalHash = tokenHash("ambiguous-token");
      const invitationId = await insertInvitation({ quoteRequestId, profileId, seed: "ambiguous-token" });

      await client.query(
        "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
        [invitationId, originalDispatchToken],
      );
      await client.query("update marketplace_quote_invitations set status = 'pending' where id = $1", [invitationId]);
      await client.query("update marketplace_quote_invitations set status = 'delivery_failed' where id = $1", [invitationId]);

      const state = await client.query<{ status: string; token_hash: string; dispatch_token: string }>(
        "select status, token_hash, dispatch_token::text from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(state.rows[0]).toMatchObject({
        status: "delivery_uncertain",
        token_hash: originalHash,
        dispatch_token: originalDispatchToken,
      });
    });

    it("keeps a definite pre-provider failure retryable with a new attempt token", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId });
      const firstDispatchToken = randomUUID();
      const secondDispatchToken = randomUUID();

      await client.query(
        "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
        [invitationId, firstDispatchToken],
      );
      await client.query(
        "update marketplace_quote_invitations set status = 'delivery_failed', provider_claimed_at = null where id = $1",
        [invitationId],
      );
      await client.query(
        "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
        [invitationId, secondDispatchToken],
      );

      const state = await client.query<{ status: string; dispatch_token: string; provider_claimed_at: Date | null }>(
        "select status, dispatch_token::text, provider_claimed_at from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(state.rows[0]?.status).toBe("sending");
      expect(state.rows[0]?.dispatch_token).toBe(secondDispatchToken);
      expect(state.rows[0]?.provider_claimed_at).toBeNull();
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

    it("makes updated_at authoritative on every invitation update", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId });
      await client.query(
        "update marketplace_quote_invitations set updated_at = '2000-01-01T00:00:00Z' where id = $1",
        [invitationId],
      );
      const state = await client.query<{ updated_at: Date }>(
        "select updated_at from marketplace_quote_invitations where id = $1",
        [invitationId],
      );
      expect(state.rows[0]?.updated_at.getTime()).toBeGreaterThan(Date.now() - 30_000);
    });

    it("uses the concurrent normalized recipient index for whitespace/case variants", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({
        quoteRequestId,
        profileId,
        recipientEmail: "  Offert@Example.SE  ",
      });

      await client.query("set enable_seqscan = off");
      try {
        const lookup = await client.query<{ id: string }>(`
          select id::text
          from marketplace_quote_invitations
          where lower(btrim(recipient_email)) = 'offert@example.se'
        `);
        expect(lookup.rows.map((row) => row.id)).toContain(invitationId);

        const plan = await client.query<{ "QUERY PLAN": string }>(`
          explain (costs off)
          select id
          from marketplace_quote_invitations
          where lower(btrim(recipient_email)) = 'offert@example.se'
        `);
        expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n"))
          .toContain("marketplace_quote_invitations_recipient_norm_idx");
      } finally {
        await client.query("reset enable_seqscan");
      }
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

        const preCommitState = await Promise.race([
          dispatchPromise.then(() => "settled" as const),
          delay(200).then(() => "blocked" as const),
        ]);
        expect(preCommitState).toBe("blocked");

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

    it("serializes profile revocation with dispatch without a deadlock", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const invitationId = await insertInvitation({ quoteRequestId, profileId });
      const revoker = new Client({ connectionString });
      const dispatcher = new Client({ connectionString });
      await revoker.connect();
      await dispatcher.connect();
      try {
        await revoker.query("begin");
        await revoker.query(
          "select pg_advisory_xact_lock(hashtextextended('marketplace_profile:' || $1::text, 0))",
          [profileId],
        );

        const dispatchPromise = dispatcher.query(
          "update marketplace_quote_invitations set status = 'sending', dispatch_token = $2 where id = $1",
          [invitationId, randomUUID()],
        ).then(
          () => ({ ok: true as const, code: "", message: "" }),
          (error) => ({ ok: false as const, ...pgError(error) }),
        );

        const waiting = await Promise.race([
          dispatchPromise.then(() => "settled" as const),
          delay(200).then(() => "blocked" as const),
        ]);
        expect(waiting).toBe("blocked");

        await revoker.query(
          "update company_directory_profiles set publication_status = 'blocked', privacy_blocked = true where id = $1",
          [profileId],
        );
        await revoker.query("commit");

        const dispatch = await dispatchPromise;
        expect(dispatch.ok).toBe(false);
        expect(dispatch.code).toBe("23514");
        expect(dispatch.message).toContain("marketplace_profile_ineligible");
      } finally {
        await revoker.query("rollback").catch(() => undefined);
        await revoker.end();
        await dispatcher.end();
      }
    });
  });
} else {
  describe.skip("marketplace guest runtime PostgreSQL hardening", () => {
    it("requires CI or PROFFERA_POSTGRES_INTEGRATION=1", () => {
      // Report as skipped outside the explicit integration environment.
    });
  });
}
