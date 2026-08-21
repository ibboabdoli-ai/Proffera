import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const migrationFiles = [
  "20260820_0049_marketplace_guest_quotes.sql",
  "20260820_0050_marketplace_guest_dispatch_claim.sql",
  "20260820_0051_marketplace_guest_runtime_eligibility.sql",
  "20260821_0052_marketplace_guest_final_hardening.sql",
  "20260821_0053_marketplace_guest_recipient_index.sql",
  "20260821_0054_marketplace_guest_status_validation.sql",
] as const;

const baseline = readFileSync(
  join(process.cwd(), "tests/fixtures/marketplace-guest-production-baseline.sql"),
  "utf8",
);

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function hash(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { code: "", message: String(error ?? "") };
  const candidate = error as { code?: unknown; message?: unknown };
  return { code: String(candidate.code ?? ""), message: String(candidate.message ?? "") };
}

async function applyMigration(client: Client, file: string) {
  const sql = readFileSync(join(process.cwd(), "db/migrations", file), "utf8");
  if (!file.includes("0053_marketplace_guest_recipient_index")) {
    await client.query(sql);
    return;
  }

  // 0053 must execute outside a wrapping transaction. Strip line comments before
  // splitting so punctuation in deployment notes can never become executable SQL.
  const executable = sql
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  const statements = executable.split(";").map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) await client.query(statement);
}

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("marketplace guest final PostgreSQL hardening", () => {
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

    async function insertQuoteAndProfile() {
      const quoteRequestId = randomUUID();
      const profileId = randomUUID();
      await client.query(`
        insert into quote_requests (
          id, category, service_type, city, postal_code, description,
          preferred_date, contact_name, contact_email, contact_phone,
          consent_accepted, status, reference_id
        ) values (
          $1, 'vvs', 'Rörmokare', 'Södertälje', '15100', 'Integration request',
          '', 'Test Customer', 'customer@example.test', '0700000000',
          true, 'submitted', $2
        )
      `, [quoteRequestId, `PF-${quoteRequestId}`]);
      await client.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          is_active, category_slug, city, municipality, public_slug,
          publication_status, quality_score, privacy_blocked, auto_public_eligible
        ) values (
          $1, $2, 'juridical_person', 'Integration Företag AB', 'Integration Företag AB',
          true, 'vvs', 'Södertälje', 'Södertälje', $3,
          'published', 95, false, true
        )
      `, [profileId, profileId.replace(/-/gu, "").slice(0, 10), `profile-${profileId}`]);
      return { quoteRequestId, profileId };
    }

    async function insertInvitation(input: {
      quoteRequestId: string;
      profileId: string;
      status: string;
      tokenHash: string;
      optOutTokenHash?: string;
      dispatchToken?: string | null;
      providerClaimedAt?: Date | null;
      updatedAt?: Date;
    }) {
      const result = await client.query<{ id: string }>(`
        insert into marketplace_quote_invitations (
          quote_request_id, profile_id, recipient_email, token_hash, opt_out_token_hash,
          dispatch_token, provider_claimed_at, status, wave, match_score, match_reasons,
          contact_basis, expires_at, created_by_admin_user_id, updated_at
        ) values (
          $1, $2, 'offert@example.se', $3, $4, $5, $6, $7,
          1, 90, '[]'::jsonb, 'manual_business_contact', now() + interval '7 days',
          'integration-test', $8
        ) returning id::text
      `, [
        input.quoteRequestId,
        input.profileId,
        input.tokenHash,
        input.optOutTokenHash ?? input.tokenHash,
        input.dispatchToken ?? null,
        input.providerClaimedAt ?? null,
        input.status,
        input.updatedAt ?? new Date(),
      ]);
      return String(result.rows[0]?.id ?? "");
    }

    beforeAll(async () => {
      containerName = `proffera-guest-final-${process.pid}-${Date.now()}`;
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
      if (!port) throw new Error(`Could not resolve PostgreSQL port from: ${portLine}`);
      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();
      await client.query(baseline);
      for (const file of migrationFiles) await applyMigration(client, file);
    }, 120_000);

    beforeEach(async () => {
      await client.query(`
        truncate table marketplace_quote_offers,
          marketplace_outreach_suppressions,
          marketplace_quote_invitations,
          quote_requests,
          company_directory_profiles,
          workspaces cascade
      `);
    });

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm can remove a failed container first.
        }
      }
    }, 30_000);

    it("validates the status constraint and keeps the normalized recipient index valid", async () => {
      const constraint = await client.query<{ convalidated: boolean }>(`
        select convalidated
        from pg_constraint
        where conrelid = 'marketplace_quote_invitations'::regclass
          and conname = 'marketplace_quote_invitations_status_check'
      `);
      expect(constraint.rows[0]?.convalidated).toBe(true);

      const index = await client.query<{ indisvalid: boolean }>(`
        select pg_index.indisvalid
        from pg_index
        join pg_class on pg_class.oid = pg_index.indexrelid
        where pg_class.relname = 'marketplace_quote_invitations_recipient_norm_idx'
      `);
      expect(index.rows[0]?.indisvalid).toBe(true);
    });

    it("revokes quote access without breaking the emailed opt-out credential", async () => {
      const { quoteRequestId, profileId } = await insertQuoteAndProfile();
      const quoteTokenHash = hash("quote-token");
      const optOutTokenHash = hash("opt-out-token");
      const invitationId = await insertInvitation({
        quoteRequestId,
        profileId,
        status: "sent",
        tokenHash: quoteTokenHash,
        optOutTokenHash,
      });

      await client.query(`
        update company_directory_profiles
        set publication_status = 'review', privacy_blocked = true
        where id = $1
      `, [profileId]);

      const state = await client.query<{
        status: string;
        token_hash: string;
        opt_out_token_hash: string;
      }>(`
        select status, token_hash, opt_out_token_hash
        from marketplace_quote_invitations
        where id = $1
      `, [invitationId]);
      expect(state.rows[0]?.status).toBe("cancelled");
      expect(state.rows[0]?.token_hash).not.toBe(quoteTokenHash);
      expect(state.rows[0]?.opt_out_token_hash).toBe(optOutTokenHash);
    });

    it("keeps a provider claim immutable and makes stale same-token retries uncertain", async () => {
      const first = await insertQuoteAndProfile();
      const dispatchToken = randomUUID();
      const invitationId = await insertInvitation({
        quoteRequestId: first.quoteRequestId,
        profileId: first.profileId,
        status: "sending",
        tokenHash: hash("claimed-token"),
        dispatchToken,
      });
      await client.query(`
        update marketplace_quote_invitations
        set status = 'pending'
        where id = $1
      `, [invitationId]);

      const claimed = await client.query<{ provider_claimed_at: Date | null }>(`
        select provider_claimed_at from marketplace_quote_invitations where id = $1
      `, [invitationId]);
      expect(claimed.rows[0]?.provider_claimed_at).not.toBeNull();

      let clearError: unknown = null;
      try {
        await client.query(`
          update marketplace_quote_invitations
          set status = 'delivery_failed', provider_claimed_at = null
          where id = $1
        `, [invitationId]);
      } catch (error) {
        clearError = error;
      }
      expect(errorDetails(clearError).code).toBe("23514");
      expect(errorDetails(clearError).message).toContain("marketplace_provider_claim_immutable");

      const second = await insertQuoteAndProfile();
      const staleDispatchToken = randomUUID();
      const staleTokenHash = hash("stale-claimed-token");
      const staleId = await insertInvitation({
        quoteRequestId: second.quoteRequestId,
        profileId: second.profileId,
        status: "pending",
        tokenHash: staleTokenHash,
        dispatchToken: staleDispatchToken,
        providerClaimedAt: new Date(Date.now() - 10 * 60_000),
        updatedAt: new Date(Date.now() - 10 * 60_000),
      });
      await client.query(`
        update marketplace_quote_invitations
        set status = 'sending', dispatch_token = $2
        where id = $1
      `, [staleId, staleDispatchToken]);

      const staleState = await client.query<{
        status: string;
        token_hash: string;
        dispatch_token: string;
      }>(`
        select status, token_hash, dispatch_token::text
        from marketplace_quote_invitations
        where id = $1
      `, [staleId]);
      expect(staleState.rows[0]).toMatchObject({
        status: "delivery_uncertain",
        token_hash: staleTokenHash,
        dispatch_token: staleDispatchToken,
      });
    });
  });
} else {
  describe.skip("marketplace guest final PostgreSQL hardening", () => {
    it("requires GitHub Actions or PROFFERA_POSTGRES_INTEGRATION=1", () => undefined);
  });
}