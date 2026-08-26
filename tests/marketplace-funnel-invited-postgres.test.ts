import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const baseline = readFileSync(
  join(process.cwd(), "tests/fixtures/marketplace-guest-production-baseline.sql"),
  "utf8",
);

const migrationFiles = [
  "20260616_0002_proffera_workspace_schema.sql",
  "20260809_0037_company_profile_engine_foundation.sql",
  "20260820_0049_marketplace_guest_quotes.sql",
] as const;

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

async function applyMigration(client: Client, file: string) {
  await client.query(readFileSync(join(process.cwd(), "db/migrations", file), "utf8"));
}

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("Marketplace Invited funnel PostgreSQL evidence", () => {
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
      containerName = `proffera-funnel-invited-${process.pid}-${Date.now()}`;
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
      await client.query('create table "user" (id text primary key)');
      for (const file of migrationFiles) await applyMigration(client, file);
    }, 120_000);

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

    it("counts only invitations with persisted sent_at delivery evidence", async () => {
      async function seedInvitation(status: "sent" | "delivery_failed", sentAt: Date | null) {
        const requestId = randomUUID();
        const workspaceId = randomUUID();
        const profileId = randomUUID();
        const tokenHash = profileId.replace(/-/gu, "").padEnd(64, "0");

        await client.query(`
          insert into quote_requests (
            id, category, service_type, city, postal_code, description,
            preferred_date, contact_name, contact_email, contact_phone,
            consent_accepted, status, reference_id, created_at
          ) values ($1, 'vvs', 'Rörmokare', 'Södertälje', '15100', 'Invited funnel test', '',
            'Test Customer', 'customer@example.test', '0700000000', true, 'submitted', $2, now())
        `, [requestId, `PF-${requestId}`]);
        await client.query(`
          insert into workspaces (id, slug, name, company_name, primary_city, status)
          values ($1, $2, 'Invitation Provider', 'Invitation Provider AB', 'Södertälje', 'trial')
        `, [workspaceId, `ws-${workspaceId}`]);
        await client.query(`
          insert into company_directory_profiles (
            id, organization_number, organization_kind, legal_name, display_name,
            is_active, category_slug, city, municipality, public_slug,
            publication_status, quality_score, privacy_blocked, auto_public_eligible,
            claimed_workspace_id
          ) values ($1, $2, 'juridical_person', 'Invitation Provider AB', 'Invitation Provider AB',
            true, 'vvs', 'Södertälje', 'Södertälje', $3,
            'claimed', 95, false, true, $4)
        `, [
          profileId,
          profileId.replace(/-/gu, "").slice(0, 10),
          `profile-${profileId}`,
          workspaceId,
        ]);
        await client.query(`
          insert into marketplace_quote_invitations (
            quote_request_id, profile_id, workspace_id, recipient_email, token_hash,
            status, wave, match_score, match_reasons, contact_basis, expires_at,
            sent_at, created_by_admin_user_id
          ) values ($1, $2, $3, 'provider@example.se', $4, $5, 1, 90, '[]'::jsonb,
            'manual_business_contact', now() + interval '7 days', $6, 'integration-test')
        `, [requestId, profileId, workspaceId, tokenHash, status, sentAt]);
      }

      await seedInvitation("sent", new Date());
      await seedInvitation("delivery_failed", null);

      const { readAdminMarketplaceInvitedCount } = await import(
        "@/features/admin/marketplace-funnel"
      );
      const pgSql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        let text = "";
        const parameters: unknown[] = [];
        strings.forEach((part, index) => {
          text += part;
          if (index < values.length) {
            parameters.push(values[index]);
            text += `$${parameters.length}`;
          }
        });
        const result = await client.query(text, parameters);
        return result.rows;
      }) as unknown as Parameters<typeof readAdminMarketplaceInvitedCount>[0];

      await expect(readAdminMarketplaceInvitedCount(pgSql)).resolves.toBe(1);
    });
  });
}
