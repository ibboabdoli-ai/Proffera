import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  provisionWorkspace: vi.fn(),
  createWorkspaceSlug: vi.fn(() => "ror-ab-test"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/company/workspace-provisioning", () => ({
  provisionWorkspace: mocks.provisionWorkspace,
  createWorkspaceSlug: mocks.createWorkspaceSlug,
}));

import { tryAutoProvisionMarketplaceCompanyClaim } from "@/lib/company-directory-marketplace-claim";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const CLAIM_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const INVITATION_ID = "33333333-3333-4333-8333-333333333333";
const QUOTE_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "marketplace-owner-user";
const BUSINESS_EMAIL = "offert@rorfirma.se";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function postgresSql(client: Client) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    const result = await client.query(query, values);
    return result.rows as Record<string, unknown>[];
  };
}

function verifiedEvidence() {
  return JSON.stringify({
    version: 1,
    stage: "business_email_verified",
    claimantName: "Anna Andersson",
    role: "Ägare",
    businessEmail: BUSINESS_EMAIL,
    phone: "0701234567",
    accountEmail: BUSINESS_EMAIL,
    emailDomainKind: "business_domain",
    codeAttempts: 0,
    codeSentAt: "2026-08-23T10:00:00.000Z",
    businessEmailVerifiedAt: "2026-08-23T10:02:00.000Z",
  });
}

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "Marketplace claim authority finalization PostgreSQL race",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;

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
      containerName = `proffera-claim-authority-race-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgis/postgis:16-3.5-alpine",
      ]);
      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
      const port = portLine.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);
      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();
      await applyCanonicalProfferaMigrations(client);
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

    beforeEach(async () => {
      vi.clearAllMocks();
      if (!client) throw new Error("PostgreSQL test client is not initialized");
      mocks.getSql.mockReturnValue(postgresSql(client));

      await client.query(`
        truncate table
          marketplace_quote_offers,
          marketplace_quote_invitations,
          company_directory_scb_enrichment,
          company_directory_official_facts,
          company_directory_claims,
          company_directory_profiles,
          workspace_memberships,
          workspaces,
          quote_requests,
          "user"
        restart identity cascade
      `);

      await client.query(
        'insert into "user" ("id", "name", "email", "emailVerified") values ($1, $2, $3, true)',
        [USER_ID, "Anna Andersson", BUSINESS_EMAIL],
      );

      await client.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          legal_form, organization_status, is_active, category_slug, city, municipality,
          public_slug, publication_status, quality_score, privacy_blocked, auto_public_eligible,
          activity_description, official_source
        ) values (
          $1::uuid, '5560000000', 'juridical_person', 'Rör AB', 'Rör AB',
          'Aktiebolag', 'Registrerad', true, 'vvs', 'Södertälje', 'Södertälje',
          'ror-ab', 'ready', 95, false, true,
          'Rörarbeten', 'bolagsverket_vardefulla_datamangder:company'
        )
      `, [PROFILE_ID]);

      const profile = await client.query<{ updated_at: string; last_synced_at: string }>(
        "select updated_at::text, last_synced_at::text from company_directory_profiles where id = $1::uuid",
        [PROFILE_ID],
      );
      const profileUpdatedToken = String(profile.rows[0]?.updated_at ?? "");
      const profileLastSyncedToken = String(profile.rows[0]?.last_synced_at ?? "");

      await client.query(`
        insert into company_directory_official_facts (
          profile_id, advertising_blocked, ongoing_procedures,
          source_payload_hash, last_synced_at
        ) values ($1::uuid, false, '[]'::jsonb, 'facts-hash', $2::timestamptz)
      `, [PROFILE_ID, profileLastSyncedToken]);

      const facts = await client.query<{ last_synced_at: string }>(
        "select last_synced_at::text from company_directory_official_facts where profile_id = $1::uuid",
        [PROFILE_ID],
      );
      const factsLastSyncedToken = String(facts.rows[0]?.last_synced_at ?? "");

      await client.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, observed_company_name, email,
          workplaces, provenance, conflicts, source_payload_hash, last_synced_at
        ) values (
          $1::uuid, '5560000000', 'Rör AB', $2,
          $3::jsonb, $4::jsonb, '[]'::jsonb, 'scb-hash', now()
        )
      `, [
        PROFILE_ID,
        BUSINESS_EMAIL,
        JSON.stringify([{
          visitingAddress: {
            addressLine: "Storgatan 1",
            postalCode: "151 46",
            city: "SÖDERTÄLJE",
          },
          municipality: "SÖDERTÄLJE",
        }]),
        JSON.stringify({
          comparisonSnapshot: {
            profileUpdatedToken,
            officialFactsLastSyncedToken: factsLastSyncedToken,
          },
        }),
      ]);

      await client.query(
        "update company_directory_profiles set publication_status = 'published', published_at = now() where id = $1::uuid",
        [PROFILE_ID],
      );

      await client.query(`
        insert into company_directory_claims (
          id, profile_id, claimant_user_id, status, verification_method, verification_reference
        ) values ($1::uuid, $2::uuid, $3, 'pending', 'email_domain', $4)
      `, [CLAIM_ID, PROFILE_ID, USER_ID, verifiedEvidence()]);

      await client.query(`
        insert into quote_requests (
          id, reference_id, category, service_type, city, postal_code, description,
          contact_name, contact_email, contact_phone, consent_accepted, status
        ) values (
          $1::uuid, 'PF-CLAIM-RACE', 'VVS', 'Rörmokare', 'Södertälje', '151 46',
          'Claim authority race', 'Kund', 'kund@example.test', '0700000000', true, 'submitted'
        )
      `, [QUOTE_ID]);

      await client.query(`
        insert into marketplace_quote_invitations (
          id, quote_request_id, profile_id, recipient_email, token_hash, status,
          wave, match_score, match_reasons, contact_basis, expires_at, sent_at,
          created_by_admin_user_id
        ) values (
          $1::uuid, $2::uuid, $3::uuid, $4, repeat('a', 64), 'sent',
          1, 90, '[]'::jsonb, 'official_business_register', now() + interval '1 day', now(),
          'claim-authority-race'
        )
      `, [INVITATION_ID, QUOTE_ID, PROFILE_ID, BUSINESS_EMAIL]);

      mocks.provisionWorkspace.mockImplementation(async ({ workspaceId, userId, slug, companyName, city, email, phone }) => {
        if (!client) throw new Error("PostgreSQL test client is not initialized");
        await client.query(`
          insert into workspaces (
            id, slug, name, company_name, primary_city, contact_email, contact_phone, status
          ) values ($1::uuid, $2, $3, $3, $4, $5, $6, 'trial')
        `, [workspaceId, slug, companyName, city, email, phone]);
        await client.query(`
          insert into workspace_memberships (id, workspace_id, user_id, role)
          values (gen_random_uuid(), $1::uuid, $2, 'owner')
        `, [workspaceId, userId]);

        await client.query(
          "update company_directory_official_facts set advertising_blocked = true where profile_id = $1::uuid",
          [PROFILE_ID],
        );
        return { workspaceId, trialEndsAt: "2099-01-01T00:00:00.000Z" };
      });
    });

    it("fails finalization, keeps the profile unclaimed, and releases its reservation after authority withdrawal", async () => {
      if (!client) throw new Error("PostgreSQL test client is not initialized");

      const result = await tryAutoProvisionMarketplaceCompanyClaim({
        claimId: CLAIM_ID,
        claimantUserId: USER_ID,
      });

      expect(result).toEqual({ status: "manual_review", reason: "finalize_conflict" });

      const profile = await client.query<{
        claimed_workspace_id: string | null;
        claim_reservation_id: string | null;
        claim_reservation_token: string | null;
      }>(`
        select
          claimed_workspace_id::text,
          claim_reservation_id::text,
          claim_reservation_token::text
        from company_directory_profiles
        where id = $1::uuid
      `, [PROFILE_ID]);
      expect(profile.rows[0]).toMatchObject({
        claimed_workspace_id: null,
        claim_reservation_id: null,
        claim_reservation_token: null,
      });

      const workspace = await client.query(
        "select id from workspaces where id = $1::uuid",
        [CLAIM_ID],
      );
      expect(workspace.rowCount).toBe(0);
    }, 30_000);
  },
);
