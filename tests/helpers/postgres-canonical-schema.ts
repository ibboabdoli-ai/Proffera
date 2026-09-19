import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Client } from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "db/migrations");
const LEGACY_MIGRATIONS_DIR = join(process.cwd(), "db/legacy-migrations");
const EXTERNAL_BOOTSTRAP_BEFORE = "20260809_0036_public_business_hub.sql";

async function createHistoricalBootstrapPrerequisites(client: Client) {
  await client.query("create extension if not exists pgcrypto");
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
  `);
}

export async function applyCanonicalProfferaMigrations(client: Client) {
  const migrationFiles = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  await createHistoricalBootstrapPrerequisites(client);

  let externalPrerequisitesReady = false;

  for (const file of migrationFiles) {
    if (!externalPrerequisitesReady && file >= EXTERNAL_BOOTSTRAP_BEFORE) {
      await createExternalBootstrapPrerequisites(client);
      externalPrerequisitesReady = true;
    }

    const migration = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await client.query(migration);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Canonical migration ${file} failed: ${message}`, { cause: error });
    }
  }
}
