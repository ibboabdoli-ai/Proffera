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
  "20260718_0010_workspace_stripe_billing.sql",
] as const;

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

async function applyMigration(client: Client, file: string) {
  await client.query(readFileSync(join(process.cwd(), "db/migrations", file), "utf8"));
}

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("Marketplace claim/paid funnel PostgreSQL attribution", () => {
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
      containerName = `proffera-funnel-claim-paid-${process.pid}-${Date.now()}`;
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
      // 0002 owns workspace_plans but depends on Better Auth's user table. The
      // integration fixture creates only that external prerequisite, then uses
      // canonical Proffera migrations for all graph tables under test.
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

    it("executes the production claim/paid query and keeps attribution request-level", async () => {
      const now = Date.now();

      async function seedRequest(createdAt: Date) {
        const id = randomUUID();
        await client.query(`
          insert into quote_requests (
            id, category, service_type, city, postal_code, description,
            preferred_date, contact_name, contact_email, contact_phone,
            consent_accepted, status, reference_id, created_at
          ) values ($1, 'vvs', 'Rörmokare', 'Södertälje', '15100', 'Funnel test', '',
            'Test Customer', 'customer@example.test', '0700000000', true, 'submitted', $2, $3)
        `, [id, `PF-${id}`, createdAt]);
        return id;
      }

      async function seedProvider(input: {
        requestId: string;
        requestCreatedAt: Date;
        claimOffsetMs: number;
        claimRequestedOffsetMs?: number;
        claimStatus?: "claimed" | "verified";
        billingStatus?: "active" | "trialing" | "past_due";
        billingCreatedOffsetMs?: number;
      }) {
        const workspaceId = randomUUID();
        const profileId = randomUUID();
        const claimId = randomUUID();
        const claimRequestedAt = new Date(
          input.requestCreatedAt.getTime() + (input.claimRequestedOffsetMs ?? 30_000),
        );
        const claimResolvedAt = new Date(input.requestCreatedAt.getTime() + input.claimOffsetMs);
        const invitationTokenHash = profileId.replace(/-/gu, "").padEnd(64, "0");

        await client.query(`
          insert into workspaces (id, slug, name, company_name, primary_city, status)
          values ($1, $2, 'Funnel Provider', 'Funnel Provider AB', 'Södertälje', 'trial')
        `, [workspaceId, `ws-${workspaceId}`]);
        await client.query(`
          insert into company_directory_profiles (
            id, organization_number, organization_kind, legal_name, display_name,
            is_active, category_slug, city, municipality, public_slug,
            publication_status, quality_score, privacy_blocked, auto_public_eligible,
            claimed_workspace_id
          ) values ($1, $2, 'juridical_person', 'Funnel Provider AB', 'Funnel Provider AB',
            true, 'vvs', 'Södertälje', 'Södertälje', $3,
            'claimed', 95, false, true, $4)
        `, [profileId, profileId.replace(/-/gu, "").slice(0, 10), `profile-${profileId}`, workspaceId]);
        await client.query(`
          insert into marketplace_quote_invitations (
            quote_request_id, profile_id, workspace_id, recipient_email, token_hash,
            status, wave, match_score, match_reasons, contact_basis, expires_at,
            sent_at, created_by_admin_user_id
          ) values ($1, $2, $3, 'provider@example.se', $4, 'sent', 1, 90, '[]'::jsonb,
            'manual_business_contact', now() + interval '7 days', now(), 'integration-test')
        `, [input.requestId, profileId, workspaceId, invitationTokenHash]);
        await client.query(`
          insert into company_directory_claims (
            id, profile_id, claimant_user_id, requested_workspace_id, status,
            verification_method, requested_at, resolved_at
          ) values ($1, $2, 'integration-user', $3, $4, 'email_domain', $5, $6)
        `, [claimId, profileId, workspaceId, input.claimStatus ?? "claimed", claimRequestedAt, claimResolvedAt]);

        if (input.billingStatus) {
          const billingCreatedAt = new Date(
            claimResolvedAt.getTime() + (input.billingCreatedOffsetMs ?? 60_000),
          );
          await client.query(`
            insert into workspace_billing_subscriptions (
              id, workspace_id, stripe_subscription_id, stripe_price_id, status, created_at
            ) values ($1, $2, $3, 'price_test', $4, $5)
          `, [randomUUID(), workspaceId, `sub_${workspaceId.replace(/-/gu, "")}`, input.billingStatus, billingCreatedAt]);
        }
      }

      const paidRequestCreated = new Date(now - 2 * 24 * 60 * 60_000);
      const paidRequest = await seedRequest(paidRequestCreated);
      await seedProvider({ requestId: paidRequest, requestCreatedAt: paidRequestCreated, claimOffsetMs: 60_000, billingStatus: "active" });
      await seedProvider({ requestId: paidRequest, requestCreatedAt: paidRequestCreated, claimOffsetMs: 120_000, billingStatus: "trialing" });

      const claimedOnlyCreated = new Date(now - 36 * 60 * 60_000);
      const claimedOnly = await seedRequest(claimedOnlyCreated);
      await seedProvider({ requestId: claimedOnly, requestCreatedAt: claimedOnlyCreated, claimOffsetMs: 60_000, billingStatus: "past_due" });
      await seedProvider({
        requestId: claimedOnly,
        requestCreatedAt: claimedOnlyCreated,
        claimOffsetMs: 120_000,
        billingStatus: "active",
        billingCreatedOffsetMs: 0,
      });

      const preRequestClaimCreated = new Date(now - 24 * 60 * 60_000);
      const preRequestClaim = await seedRequest(preRequestClaimCreated);
      await seedProvider({ requestId: preRequestClaim, requestCreatedAt: preRequestClaimCreated, claimOffsetMs: -60_000, billingStatus: "active" });

      const preRequestInitiationCreated = new Date(now - 18 * 60 * 60_000);
      const preRequestInitiation = await seedRequest(preRequestInitiationCreated);
      await seedProvider({
        requestId: preRequestInitiation,
        requestCreatedAt: preRequestInitiationCreated,
        claimRequestedOffsetMs: -60_000,
        claimOffsetMs: 60_000,
        billingStatus: "active",
      });

      const verifiedOnlyCreated = new Date(now - 12 * 60 * 60_000);
      const verifiedOnly = await seedRequest(verifiedOnlyCreated);
      await seedProvider({ requestId: verifiedOnly, requestCreatedAt: verifiedOnlyCreated, claimOffsetMs: 60_000, claimStatus: "verified", billingStatus: "active" });

      const preClaimBillingCreated = new Date(now - 6 * 60 * 60_000);
      const preClaimBilling = await seedRequest(preClaimBillingCreated);
      await seedProvider({ requestId: preClaimBilling, requestCreatedAt: preClaimBillingCreated, claimOffsetMs: 120_000, billingStatus: "active", billingCreatedOffsetMs: -60_000 });

      const oldRequestCreated = new Date(now - 31 * 24 * 60 * 60_000);
      const oldRequest = await seedRequest(oldRequestCreated);
      await seedProvider({ requestId: oldRequest, requestCreatedAt: oldRequestCreated, claimOffsetMs: 60_000, billingStatus: "active" });

      const { readAdminMarketplaceClaimPaidCounts } = await import(
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
      }) as unknown as Parameters<typeof readAdminMarketplaceClaimPaidCounts>[0];

      const counts = await readAdminMarketplaceClaimPaidCounts(pgSql);
      expect(counts).toEqual({ claimedRequests: 3, paidRequests: 1 });
    });
  });
}
