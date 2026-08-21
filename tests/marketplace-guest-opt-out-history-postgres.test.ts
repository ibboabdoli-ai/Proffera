import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  "20260821_0055_marketplace_guest_opt_out_history.sql",
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

  const executable = sql
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  const statements = executable.split(";").map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) await client.query(statement);
}

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("marketplace guest historical opt-out PostgreSQL contract", () => {
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

    beforeAll(async () => {
      containerName = `proffera-guest-optout-${process.pid}-${Date.now()}`;
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

    it("archives the old emailed opt-out token when an expired sent invitation is reused", async () => {
      const quoteRequestId = randomUUID();
      const profileId = randomUUID();
      const invitationId = randomUUID();
      const oldTokenHash = hash("old-delivered-opt-out-token");
      const newTokenHash = hash("new-reused-opt-out-token");
      const dispatchToken = randomUUID();

      await client.query(`
        insert into quote_requests (
          id, category, service_type, city, postal_code, description,
          preferred_date, contact_name, contact_email, contact_phone,
          consent_accepted, status, reference_id
        ) values (
          $1, 'vvs', 'Rörmokare', 'Södertälje', '15100', 'History test request',
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
          $1, $2, 'juridical_person', 'History Företag AB', 'History Företag AB',
          true, 'vvs', 'Södertälje', 'Södertälje', $3,
          'published', 95, false, true
        )
      `, [profileId, profileId.replace(/-/gu, "").slice(0, 10), `history-${profileId}`]);

      await client.query(`
        insert into marketplace_quote_invitations (
          id, quote_request_id, profile_id, recipient_email, token_hash,
          opt_out_token_hash, status, wave, match_score, match_reasons,
          contact_basis, expires_at, created_by_admin_user_id
        ) values (
          $1, $2, $3, 'old-contact@example.se', $4, $4, 'sent',
          1, 90, '[]'::jsonb, 'manual_business_contact', now() - interval '1 day',
          'integration-test'
        )
      `, [invitationId, quoteRequestId, profileId, oldTokenHash]);

      await client.query(`
        update marketplace_quote_invitations
        set recipient_email = 'new-contact@example.se',
            token_hash = $2,
            opt_out_token_hash = $2,
            dispatch_token = $3,
            status = 'sending',
            expires_at = now() + interval '7 days'
        where id = $1
      `, [invitationId, newTokenHash, dispatchToken]);

      const archived = await client.query<{
        invitation_id: string;
        profile_id: string;
        recipient_email_normalized: string;
        token_hash: string;
      }>(`
        select invitation_id::text, profile_id::text, recipient_email_normalized, token_hash
        from marketplace_guest_opt_out_credentials
        where token_hash = $1
      `, [oldTokenHash]);

      expect(archived.rows[0]).toMatchObject({
        invitation_id: invitationId,
        profile_id: profileId,
        recipient_email_normalized: "old-contact@example.se",
        token_hash: oldTokenHash,
      });

      const current = await client.query<{ opt_out_token_hash: string; recipient_email: string }>(`
        select opt_out_token_hash, recipient_email
        from marketplace_quote_invitations
        where id = $1
      `, [invitationId]);
      expect(current.rows[0]).toMatchObject({
        opt_out_token_hash: newTokenHash,
        recipient_email: "new-contact@example.se",
      });
    });

    it("rejects changing the recipient without rotating its opt-out credential", async () => {
      const quoteRequestId = randomUUID();
      const profileId = randomUUID();
      const tokenHash = hash("stable-opt-out-token");

      await client.query(`
        insert into quote_requests (
          id, category, service_type, city, postal_code, description,
          preferred_date, contact_name, contact_email, contact_phone,
          consent_accepted, status, reference_id
        ) values (
          $1, 'vvs', 'Rörmokare', 'Södertälje', '15100', 'Rotation test',
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
          $1, $2, 'juridical_person', 'Rotation Företag AB', 'Rotation Företag AB',
          true, 'vvs', 'Södertälje', 'Södertälje', $3,
          'published', 95, false, true
        )
      `, [profileId, profileId.replace(/-/gu, "").slice(0, 10), `rotation-${profileId}`]);
      const invitation = await client.query<{ id: string }>(`
        insert into marketplace_quote_invitations (
          quote_request_id, profile_id, recipient_email, token_hash, opt_out_token_hash,
          status, wave, match_score, match_reasons, contact_basis, expires_at,
          created_by_admin_user_id
        ) values (
          $1, $2, 'first@example.se', $3, $3, 'expired', 1, 90, '[]'::jsonb,
          'manual_business_contact', now() - interval '1 day', 'integration-test'
        ) returning id::text
      `, [quoteRequestId, profileId, tokenHash]);

      let updateError: unknown = null;
      try {
        await client.query(`
          update marketplace_quote_invitations
          set recipient_email = 'second@example.se'
          where id = $1
        `, [invitation.rows[0]?.id]);
      } catch (error) {
        updateError = error;
      }

      expect(errorDetails(updateError).code).toBe("23514");
      expect(errorDetails(updateError).message).toContain("marketplace_opt_out_token_rotation_required");
    });
  });
} else {
  describe.skip("marketplace guest historical opt-out PostgreSQL contract", () => {
    it("requires GitHub Actions or PROFFERA_POSTGRES_INTEGRATION=1", () => undefined);
  });
}