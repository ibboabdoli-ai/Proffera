import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "db/migrations/20260820_0049_marketplace_guest_quotes.sql"),
  "utf8",
);

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function pgError(error: unknown) {
  if (!error || typeof error !== "object") return { code: "", message: String(error ?? "") };
  const candidate = error as { code?: unknown; message?: unknown };
  return {
    code: String(candidate.code ?? ""),
    message: String(candidate.message ?? ""),
  };
}

function tokenHash(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

describe("marketplace guest invitation wave cap migration", () => {
  it("owns an explicit atomic transaction boundary while no production runner exists", () => {
    expect(migration).toMatch(/^\s*begin\s*;/im);
    expect(migration).toMatch(/^\s*commit\s*;/im);
    expect(migration.indexOf("begin;")).toBeLessThan(migration.lastIndexOf("commit;"));
  });

  it("only permits the two marketplace waves and preserves legacy wave provenance", () => {
    expect(migration).toContain("check (wave in (1, 2))");
    expect(migration).toContain("marketplace_invalid_wave");
    expect(migration).toContain("migration_0049_legacy_wave_");
    expect(migration).toContain("marketplace_legacy_invitation_count_exceeds_five");
  });

  it("serializes and distinguishes the 3+2 and total-five caps in PostgreSQL", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("when 1 then 3 when 2 then 2");
    expect(migration).toContain("wave_count >= wave_limit");
    expect(migration).toContain("total_count >= 5");
    expect(migration).toContain("marketplace_wave_limit");
    expect(migration).toContain("marketplace_total_limit");
  });

  it("ties each offer to the same invitation, quote request, and profile", () => {
    expect(migration).toContain("unique (id, quote_request_id, profile_id)");
    expect(migration).toContain("foreign key (invitation_id, quote_request_id, profile_id)");
    expect(migration).toContain("marketplace_offer_invitation_identity_mismatch");
  });

  it("serializes permanent opt-out with dispatch and offer eligibility", () => {
    expect(migration).toContain("lock_marketplace_outreach_suppression_recipient");
    expect(migration).toContain("enforce_marketplace_quote_invitation_outreach");
    expect(migration).toContain("enforce_marketplace_quote_offer_eligibility");
    expect(migration).toContain("marketplace_recipient_suppressed");
    expect(migration).toContain("marketplace_quote_closed");
  });
});

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("marketplace guest invitation PostgreSQL integration", () => {
    let containerName = "";
    let connectionString = "";
    let adminClient: Client | null = null;

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

    async function resetBaseTables(client: Client) {
      await client.query(`
        drop table if exists marketplace_outreach_suppressions cascade;
        drop table if exists marketplace_quote_offers cascade;
        drop table if exists marketplace_quote_invitations cascade;
        drop table if exists workspaces cascade;
        drop table if exists company_directory_profiles cascade;
        drop table if exists quote_requests cascade;

        create extension if not exists pgcrypto;
        create table quote_requests (
          id uuid primary key,
          status text not null default 'submitted',
          consent_accepted boolean not null default true
        );
        create table company_directory_profiles (id uuid primary key);
        create table workspaces (id uuid primary key);
      `);
    }

    async function createLegacyInvitationTable(client: Client) {
      await client.query(`
        create table marketplace_quote_invitations (
          id uuid primary key default gen_random_uuid(),
          quote_request_id uuid not null references quote_requests(id) on delete cascade,
          profile_id uuid not null references company_directory_profiles(id) on delete cascade,
          workspace_id uuid references workspaces(id) on delete set null,
          recipient_email text not null,
          token_hash text not null,
          status text not null default 'pending',
          wave smallint not null default 1,
          match_score smallint not null default 0,
          match_reasons jsonb not null default '[]'::jsonb,
          contact_basis text not null default 'manual_business_contact',
          expires_at timestamptz not null,
          sent_at timestamptz,
          viewed_at timestamptz,
          responded_at timestamptz,
          declined_at timestamptz,
          provider_message_id text not null default '',
          created_by_admin_user_id text not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint marketplace_quote_invitations_wave_check check (wave between 1 and 5),
          constraint marketplace_quote_invitations_quote_profile_unique unique (quote_request_id, profile_id),
          constraint marketplace_quote_invitations_token_unique unique (token_hash)
        );
      `);
    }

    async function createLegacySuppressionTable(client: Client) {
      await client.query(`
        create table marketplace_outreach_suppressions (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid references company_directory_profiles(id) on delete set null,
          email_normalized text not null,
          reason text not null default 'recipient_opt_out',
          source_invitation_id uuid references marketplace_quote_invitations(id) on delete set null,
          created_at timestamptz not null default now(),
          constraint marketplace_outreach_suppressions_email_check check (char_length(email_normalized) between 5 and 320),
          constraint marketplace_outreach_suppressions_reason_check check (char_length(reason) between 1 and 200),
          constraint marketplace_outreach_suppressions_email_unique unique (email_normalized)
        );
      `);
    }

    async function insertQuoteAndProfiles(client: Client, profileCount: number, status = "submitted") {
      const quoteRequestId = randomUUID();
      const profileIds = Array.from({ length: profileCount }, () => randomUUID());
      await client.query("insert into quote_requests (id, status, consent_accepted) values ($1, $2, true)", [quoteRequestId, status]);
      for (const profileId of profileIds) {
        await client.query("insert into company_directory_profiles (id) values ($1)", [profileId]);
      }
      return { quoteRequestId, profileIds };
    }

    async function insertInvitation(
      client: Client,
      input: {
        quoteRequestId: string;
        profileId: string;
        wave: number;
        seed: string;
        createdAt?: Date;
        status?: string;
        recipientEmail?: string;
      },
    ) {
      const result = await client.query<{ id: string }>(`
        insert into marketplace_quote_invitations (
          quote_request_id,
          profile_id,
          recipient_email,
          token_hash,
          status,
          wave,
          match_score,
          match_reasons,
          contact_basis,
          expires_at,
          created_by_admin_user_id,
          created_at,
          updated_at
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          0,
          '[]'::jsonb,
          'manual_business_contact',
          now() + interval '1 day',
          'integration-test',
          coalesce($7::timestamptz, now()),
          coalesce($7::timestamptz, now())
        )
        returning id::text
      `, [
        input.quoteRequestId,
        input.profileId,
        input.recipientEmail ?? `${input.seed}@example.se`,
        tokenHash(input.seed),
        input.status ?? "pending",
        input.wave,
        input.createdAt ?? null,
      ]);
      return String(result.rows[0]?.id ?? "");
    }

    async function transactionalInsert(input: {
      quoteRequestId: string;
      profileId: string;
      wave: number;
      seed: string;
      status?: string;
      recipientEmail?: string;
    }) {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await client.query("begin");
        await insertInvitation(client, input);
        await client.query("commit");
        return { ok: true as const, code: "", message: "" };
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        const details = pgError(error);
        return { ok: false as const, ...details };
      } finally {
        await client.end();
      }
    }

    async function insertOffer(client: Client, input: {
      invitationId: string;
      quoteRequestId: string;
      profileId: string;
    }) {
      return client.query(`
        insert into marketplace_quote_offers (
          invitation_id, quote_request_id, profile_id, price_kind
        ) values ($1, $2, $3, 'estimate')
        returning id::text
      `, [input.invitationId, input.quoteRequestId, input.profileId]);
    }

    beforeAll(async () => {
      containerName = `proffera-guest-wave-${process.pid}-${Date.now()}`;
      docker([
        "run",
        "--rm",
        "-d",
        "--name",
        containerName,
        "-e",
        "POSTGRES_PASSWORD=postgres",
        "-e",
        "POSTGRES_USER=postgres",
        "-e",
        "POSTGRES_DB=proffera_test",
        "-p",
        "127.0.0.1::5432",
        "postgres:16-alpine",
      ]);

      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/)[0] ?? "";
      const port = portLine.match(/:(\d+)$/)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);

      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      adminClient = new Client({ connectionString });
      await adminClient.connect();
    }, 120_000);

    afterAll(async () => {
      await adminClient?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // The --rm container may already have stopped after a failed test.
        }
      }
    }, 30_000);

    it("transitions legacy Wave 3..5 rows before validating the two-wave constraint", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await createLegacyInvitationTable(client);
      const { quoteRequestId, profileIds } = await insertQuoteAndProfiles(client, 5);
      const baseTime = Date.now() - 10_000;

      for (let index = 0; index < 5; index += 1) {
        await insertInvitation(client, {
          quoteRequestId,
          profileId: profileIds[index]!,
          wave: index + 1,
          seed: `legacy-${index + 1}`,
          createdAt: new Date(baseTime + index * 1_000),
        });
      }

      await client.query(migration);
      const transitioned = await client.query<{ wave: number; match_reasons: string[] }>(`
        select wave, match_reasons
        from marketplace_quote_invitations
        where quote_request_id = $1
        order by created_at, id
      `, [quoteRequestId]);

      expect(transitioned.rows.map((row) => Number(row.wave))).toEqual([1, 1, 1, 2, 2]);
      expect(transitioned.rows[2]?.match_reasons).toContain("migration_0049_legacy_wave_3");
      expect(transitioned.rows[3]?.match_reasons).toContain("migration_0049_legacy_wave_4");
      expect(transitioned.rows[4]?.match_reasons).toContain("migration_0049_legacy_wave_5");

      await expect(client.query(migration)).resolves.toBeDefined();
    }, 30_000);

    it("normalizes a safe legacy suppression before installing the invariant", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await createLegacyInvitationTable(client);
      await createLegacySuppressionTable(client);
      const profileId = randomUUID();
      await client.query("insert into company_directory_profiles (id) values ($1)", [profileId]);
      await client.query(`
        insert into marketplace_outreach_suppressions (profile_id, email_normalized)
        values ($1, '  Offert@Example.SE  ')
      `, [profileId]);

      await client.query(migration);
      const result = await client.query<{ email_normalized: string }>(`
        select email_normalized from marketplace_outreach_suppressions limit 1
      `);
      expect(result.rows[0]?.email_normalized).toBe("offert@example.se");
    }, 30_000);

    it("rejects an offer whose quote/profile identity does not match its invitation", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await client.query(migration);

      const quoteOne = randomUUID();
      const quoteTwo = randomUUID();
      const profileOne = randomUUID();
      const profileTwo = randomUUID();
      await client.query("insert into quote_requests (id) values ($1), ($2)", [quoteOne, quoteTwo]);
      await client.query("insert into company_directory_profiles (id) values ($1), ($2)", [profileOne, profileTwo]);
      const invitationId = await insertInvitation(client, {
        quoteRequestId: quoteOne,
        profileId: profileOne,
        wave: 1,
        seed: "identity-match",
      });

      let mismatchCode = "";
      try {
        await insertOffer(client, { invitationId, quoteRequestId: quoteTwo, profileId: profileTwo });
      } catch (error) {
        mismatchCode = pgError(error).code;
      }
      expect(mismatchCode).toBe("23503");
    }, 30_000);

    it("rejects an offer when the underlying quote request has closed", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await client.query(migration);
      const { quoteRequestId, profileIds } = await insertQuoteAndProfiles(client, 1, "cancelled");
      const invitationId = await insertInvitation(client, {
        quoteRequestId,
        profileId: profileIds[0]!,
        wave: 1,
        seed: "closed-quote",
      });

      let failure = { code: "", message: "" };
      try {
        await insertOffer(client, { invitationId, quoteRequestId, profileId: profileIds[0]! });
      } catch (error) {
        failure = pgError(error);
      }
      expect(failure.code).toBe("23514");
      expect(failure.message).toContain("marketplace_quote_closed");
    }, 30_000);

    it("rejects an offer after permanent recipient suppression", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await client.query(migration);
      const { quoteRequestId, profileIds } = await insertQuoteAndProfiles(client, 1);
      const recipientEmail = "suppressed-offer@example.se";
      const invitationId = await insertInvitation(client, {
        quoteRequestId,
        profileId: profileIds[0]!,
        wave: 1,
        seed: "suppressed-offer",
        recipientEmail,
      });
      await client.query(`
        insert into marketplace_outreach_suppressions (profile_id, email_normalized, source_invitation_id)
        values ($1, $2, $3)
      `, [profileIds[0], recipientEmail, invitationId]);

      let failure = { code: "", message: "" };
      try {
        await insertOffer(client, { invitationId, quoteRequestId, profileId: profileIds[0]! });
      } catch (error) {
        failure = pgError(error);
      }
      expect(failure.code).toBe("23514");
      expect(failure.message).toContain("marketplace_recipient_suppressed");
    }, 30_000);

    it("serializes a concurrent opt-out ahead of a dispatch reservation", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await client.query(migration);
      const { quoteRequestId, profileIds } = await insertQuoteAndProfiles(client, 1);
      const recipientEmail = "race-optout@example.se";
      const suppressionClient = new Client({ connectionString });
      await suppressionClient.connect();
      try {
        await suppressionClient.query("begin");
        await suppressionClient.query(`
          insert into marketplace_outreach_suppressions (profile_id, email_normalized)
          values ($1, $2)
        `, [profileIds[0], recipientEmail]);

        const dispatchAttempt = transactionalInsert({
          quoteRequestId,
          profileId: profileIds[0]!,
          wave: 1,
          seed: "race-dispatch",
          status: "sending",
          recipientEmail,
        });

        await delay(150);
        await suppressionClient.query("commit");
        const rejected = await dispatchAttempt;
        expect(rejected.ok).toBe(false);
        expect(rejected.code).toBe("23514");
        expect(rejected.message).toContain("marketplace_recipient_suppressed");
      } finally {
        await suppressionClient.query("rollback").catch(() => undefined);
        await suppressionClient.end();
      }
    }, 30_000);

    it("serializes concurrent transactions and rejects the fourth Wave 1 invite with SQLSTATE 23514", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await client.query(migration);
      const { quoteRequestId, profileIds } = await insertQuoteAndProfiles(client, 4);

      await insertInvitation(client, { quoteRequestId, profileId: profileIds[0]!, wave: 1, seed: "wave1-a" });
      await insertInvitation(client, { quoteRequestId, profileId: profileIds[1]!, wave: 1, seed: "wave1-b" });

      const results = await Promise.all([
        transactionalInsert({ quoteRequestId, profileId: profileIds[2]!, wave: 1, seed: "wave1-c" }),
        transactionalInsert({ quoteRequestId, profileId: profileIds[3]!, wave: 1, seed: "wave1-d" }),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const rejected = results.find((result) => !result.ok);
      expect(rejected?.code).toBe("23514");
      expect(rejected?.message).toContain("marketplace_wave_limit");
    }, 30_000);

    it("serializes concurrent transactions and rejects the third Wave 2 invite with SQLSTATE 23514", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await client.query(migration);
      const { quoteRequestId, profileIds } = await insertQuoteAndProfiles(client, 3);

      await insertInvitation(client, { quoteRequestId, profileId: profileIds[0]!, wave: 2, seed: "wave2-a" });
      const results = await Promise.all([
        transactionalInsert({ quoteRequestId, profileId: profileIds[1]!, wave: 2, seed: "wave2-b" }),
        transactionalInsert({ quoteRequestId, profileId: profileIds[2]!, wave: 2, seed: "wave2-c" }),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const rejected = results.find((result) => !result.ok);
      expect(rejected?.code).toBe("23514");
      expect(rejected?.message).toContain("marketplace_wave_limit");
    }, 30_000);

    it("identifies the sixth unique profile as the total-five cap", async () => {
      const client = adminClient!;
      await resetBaseTables(client);
      await client.query(migration);
      const { quoteRequestId, profileIds } = await insertQuoteAndProfiles(client, 6);

      for (let index = 0; index < 3; index += 1) {
        await insertInvitation(client, {
          quoteRequestId,
          profileId: profileIds[index]!,
          wave: 1,
          seed: `total-wave1-${index}`,
        });
      }
      for (let index = 3; index < 5; index += 1) {
        await insertInvitation(client, {
          quoteRequestId,
          profileId: profileIds[index]!,
          wave: 2,
          seed: `total-wave2-${index}`,
        });
      }

      const rejected = await transactionalInsert({
        quoteRequestId,
        profileId: profileIds[5]!,
        wave: 2,
        seed: "total-sixth",
      });
      expect(rejected.ok).toBe(false);
      expect(rejected.code).toBe("23514");
      expect(rejected.message).toContain("marketplace_total_limit");
    }, 30_000);
  });
}
