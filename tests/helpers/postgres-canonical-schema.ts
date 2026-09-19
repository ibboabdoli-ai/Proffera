import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Client } from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "db/migrations");
const LEGACY_MIGRATIONS_DIR = join(process.cwd(), "db/legacy-migrations");
const VERIFIED_REVIEW_PREREQUISITES_BEFORE = "20260807_0032_website_review_responses.sql";
const EXTERNAL_BOOTSTRAP_BEFORE = "20260809_0036_public_business_hub.sql";

const NON_TRANSACTIONAL_MIGRATIONS = new Set([
  "20260821_0053_marketplace_guest_recipient_index.sql",
  "20260822_0062_marketplace_single_winner_index.sql",
  "20260823_0065_workspace_service_directory_identity.sql",
]);

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let index = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag: string | null = null;

  while (index < sql.length) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      index += 1;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        blockComment = false;
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        current += char;
        index += 1;
      }
      continue;
    }

    if (singleQuoted) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 2;
      } else {
        if (char === "'") singleQuoted = false;
        index += 1;
      }
      continue;
    }

    if (doubleQuoted) {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        index += 2;
      } else {
        if (char === '"') doubleQuoted = false;
        index += 1;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      current += char + next;
      lineComment = true;
      index += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      current += char + next;
      blockComment = true;
      index += 2;
      continue;
    }

    if (char === "'") {
      current += char;
      singleQuoted = true;
      index += 1;
      continue;
    }

    if (char === '"') {
      current += char;
      doubleQuoted = true;
      index += 1;
      continue;
    }

    if (char === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/u);
      if (match?.[0]) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }

    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function createHistoricalBootstrapPrerequisites(client: Client) {
  await client.query("create extension if not exists pgcrypto");
  const ownerRole = await client.query("select 1 from pg_roles where rolname = 'neondb_owner'");
  if (ownerRole.rowCount === 0) {
    await client.query("create role neondb_owner nologin");
  }
  await client.query(readFileSync(
    join(LEGACY_MIGRATIONS_DIR, "001_create_quote_requests.sql"),
    "utf8",
  ));

  // company_registrations predates the active migration chain. Active
  // migrations only require its identity for FKs and then add their own
  // columns, so keep this external prerequisite intentionally minimal.
  await client.query(`
    create table if not exists company_registrations (
      id uuid primary key default gen_random_uuid()
    );
  `);

  // feature_catalog is also a historical Production prerequisite. The active
  // chain references only its identity while creating feature overrides.
  await client.query(`
    create table if not exists feature_catalog (
      feature_key text primary key
    );
  `);
}

async function createExternalBootstrapPrerequisites(client: Client) {
  // These historical tables predate the active db/migrations chain.
  // Keep only the minimum external schema allowed by AGENTS.md; everything
  // else is created by the canonical migration source of truth.
  await client.query(`
    create table if not exists workspace_experience_settings (
      workspace_id uuid primary key references workspaces(id) on delete cascade
    );

    create table if not exists admin_audit_logs (
      id uuid primary key default gen_random_uuid(),
      admin_user_id text not null,
      workspace_id uuid,
      action text not null,
      reason text,
      previous_value jsonb,
      new_value jsonb,
      created_at timestamptz not null default now()
    );

    alter table admin_audit_logs
      add column if not exists workspace_id uuid,
      add column if not exists previous_value jsonb;
  `);
}

export async function applyCanonicalProfferaMigrations(client: Client) {
  const migrationFiles = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  await createHistoricalBootstrapPrerequisites(client);

  let verifiedReviewPrerequisitesReady = false;
  let externalPrerequisitesReady = false;

  for (const file of migrationFiles) {
    if (!verifiedReviewPrerequisitesReady && file >= VERIFIED_REVIEW_PREREQUISITES_BEFORE) {
      const prerequisites = readFileSync(
        join(process.cwd(), "tests/fixtures/verified-review-production-prerequisites.sql"),
        "utf8",
      );
      await client.query(prerequisites);
      verifiedReviewPrerequisitesReady = true;
    }
    if (!externalPrerequisitesReady && file >= EXTERNAL_BOOTSTRAP_BEFORE) {
      await createExternalBootstrapPrerequisites(client);
      externalPrerequisitesReady = true;
    }

    const migration = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      if (NON_TRANSACTIONAL_MIGRATIONS.has(file)) {
        for (const statement of splitSqlStatements(migration)) {
          await client.query(statement);
        }
      } else {
        await client.query(migration);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Canonical migration ${file} failed: ${message}`, { cause: error });
    }
  }
}
