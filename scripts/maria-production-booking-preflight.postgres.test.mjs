import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { applyCanonicalProfferaMigrations } from "../tests/helpers/postgres-canonical-schema.ts";
import { inspectMariaProductionBookingDatabase } from "./maria-production-booking-preflight.mjs";

// Never touch a configured or shared database. Provision a throwaway Docker
// PostgreSQL instance using the same canonical migrations as other Maria suites.
const RUN = process.env.GITHUB_ACTIONS === "true" ||
  process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

(RUN ? describe.sequential : describe.skip)("Maria Production preflight against canonical PostgreSQL", () => {
  let container = "";
  let db;
  const workspaceId = randomUUID();

  // This query adapter executes the ACTUAL catalog and table predicates.
  // Unlike unit mocks, malformed SQL or incorrect catalog assumptions fail.
  async function inspect() {
    return inspectMariaProductionBookingDatabase((sql, params) => {
      if (!/^select\b/i.test(sql.trim())) throw new Error("Preflight attempted a write");
      return db.query(sql, params);
    });
  }

  beforeAll(async () => {
    container = "proffera-maria-preflight-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port", container, "5432/tcp"])
      .split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error("Isolated PostgreSQL port unavailable");
    const connectionString = "postgres://postgres:postgres@127.0.0.1:" + port + "/proffera_test";
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const probe = new Client({ connectionString });
      try {
        await probe.connect();
        await probe.query("select 1");
        await probe.end();
        ready = true;
        break;
      } catch {
        await probe.end().catch(() => undefined);
        await delay(500);
      }
    }
    if (!ready) throw new Error("Isolated PostgreSQL not ready");
    db = new Client({ connectionString });
    await db.connect();
    await applyCanonicalProfferaMigrations(db);

    await db.query(
      "insert into workspaces (id,slug,name,status,public_booking_slug) values ($1::uuid,'makeup-by-maria','Synthetic Maria Preflight','active','makeup-by-maria')",
      [workspaceId],
    );
    await db.query(
      "insert into workspace_settings (workspace_id,contact_email,time_zone,billing_currency) values ($1,'synthetic@example.invalid','Europe/Stockholm','SEK') on conflict (workspace_id) do update set contact_email=excluded.contact_email,time_zone=excluded.time_zone,billing_currency=excluded.billing_currency",
      [workspaceId],
    );
    await db.query(
      "insert into workspace_services (workspace_id,name,public_slug,duration_minutes,is_active,public_status,price_type,price_amount_minor) values ($1,'Synthetic bridal with trial','maria-bridal-trial-2026',180,true,'published','fixed',600000),($1,'Synthetic bridal without trial','maria-bridal-without-trial-2026',120,true,'published','fixed',500000)",
      [workspaceId],
    );
    await db.query(
      "insert into workspace_booking_hours (workspace_id,weekday,opens_at,closes_at,is_closed) values ($1,5,'07:00','18:00',false)",
      [workspaceId],
    );
  }, 180_000);

  afterAll(async () => {
    await db?.end().catch(() => undefined);
    if (container) {
      try { docker(["stop", container]); } catch { /* already removed */ }
    }
  }, 30_000);

  afterEach(async () => {
    // All intentional malformed-schema DDL is transaction-local and rolled back.
    await db?.query("ROLLBACK");
  });

  it("passes canonical 0072/0073/0074/0075/0076 with real PostgreSQL catalog queries in a READ ONLY transaction", async () => {
    await db.query("BEGIN READ ONLY");
    const result = await inspect();
    expect(result.databaseReady).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.appliedMigrations).toEqual(expect.arrayContaining([
      "20261103_0072", "20261105_0073", "20261107_0074", "20261108_0075", "20261110_0076",
    ]));
  });

  it("rejects missing 0076 ledger receipt against real PostgreSQL", async () => {
    await db.query("BEGIN");
    await db.query("delete from proffera_schema_migrations where migration_key='20261110_0076'");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("missing_migration_20261110_0076");
  });

  it("rejects a 0076 reference table missing its unique payment number despite a migration receipt", async () => {
    await db.query("BEGIN");
    await db.query("ALTER TABLE maria_booking_references DROP CONSTRAINT maria_booking_references_reference_key");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_booking_reference_unique");
    expect(result.appliedMigrations).toContain("20261110_0076");
  });

  it("accepts authorized fixed-price edits and rejects an out-of-bounds price in isolated PostgreSQL", async () => {
    await db.query("BEGIN");
    await db.query(
      "UPDATE workspace_services SET price_amount_minor=675000 WHERE workspace_id=$1 AND public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    );
    const valid = await inspect();
    expect(valid.databaseReady).toBe(true);
    expect(valid.blockers).toEqual([]);

    await db.query(
      "UPDATE workspace_services SET price_amount_minor=25000001 WHERE workspace_id=$1 AND public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    );
    const invalid = await inspect();
    expect(invalid.databaseReady).toBe(false);
    expect(invalid.blockers).toContain("service_not_ready_maria-bridal-trial-2026");
  });

  it("accepts a public 2027 after hiding 2026, but rejects an invalid later-year package", async () => {
    await db.query("BEGIN");
    await db.query("UPDATE workspace_services SET is_active=false WHERE workspace_id=$1", [workspaceId]);
    await db.query(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,is_active,public_status,price_type,price_amount_minor,maximum_advance_days) values($1,'Synthetic bridal trial 2027','maria-bridal-trial-2027',180,true,'published','fixed',610000,365)",
      [workspaceId],
    );
    const valid = await inspect();
    expect(valid.databaseReady).toBe(true);
    expect(valid.blockers).toEqual([]);
    await db.query(
      "update workspace_services set price_amount_minor=0 where workspace_id=$1 and public_slug='maria-bridal-trial-2027'",
      [workspaceId],
    );
    const invalid = await inspect();
    expect(invalid.databaseReady).toBe(false);
    expect(invalid.blockers).toContain("service_not_ready_maria-bridal-trial-2027");
    // Transaction rollback restores the original published 2026 data.
  });

  it("rejects an existing-column 0075 schema with its range CHECK missing", async () => {
    await db.query("BEGIN");
    await db.query("ALTER TABLE workspace_booking_reminder_settings DROP CONSTRAINT IF EXISTS workspace_booking_reminder_settings_cancel_notice_hours_check");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_lifecycle_cancel_notice_check");
    expect(result.appliedMigrations).toContain("20261108_0075");
  });

  it("rejects a same-named validated OR constraint that allows every integer", async () => {
    await db.query("BEGIN");
    await db.query("ALTER TABLE workspace_booking_reminder_settings DROP CONSTRAINT IF EXISTS workspace_booking_reminder_settings_cancel_notice_hours_check");
    await db.query("ALTER TABLE workspace_booking_reminder_settings ADD CONSTRAINT workspace_booking_reminder_settings_cancel_notice_hours_check CHECK (cancel_notice_hours >= 0 OR cancel_notice_hours <= 720)");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_lifecycle_cancel_notice_check");
  });

  it("rejects a same-named validated CHECK with upper bound 7200", async () => {
    await db.query("BEGIN");
    await db.query("ALTER TABLE workspace_booking_reminder_settings DROP CONSTRAINT IF EXISTS workspace_booking_reminder_settings_cancel_notice_hours_check");
    await db.query("ALTER TABLE workspace_booking_reminder_settings ADD CONSTRAINT workspace_booking_reminder_settings_cancel_notice_hours_check CHECK (cancel_notice_hours >= 0 AND cancel_notice_hours <= 7200)");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_lifecycle_cancel_notice_check");
  });

  it("rejects a missing 0075 ledger receipt despite complete columns", async () => {
    await db.query("BEGIN");
    await db.query("DELETE FROM proffera_schema_migrations WHERE migration_key='20261108_0075'");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("missing_migration_20261108_0075");
  });

  it("rejects a real 0072 table missing starts_at, even when migration is recorded", async () => {
    await db.query("BEGIN");
    await db.query("ALTER TABLE maria_manual_closed_starts DROP COLUMN starts_at CASCADE");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_manual_closed_columns");
    expect(result.blockers).toContain("invalid_manual_closed_pk");
    expect(result.appliedMigrations).toContain("20261103_0072");
  });

  it("rejects a real 0074 translation table missing service_id despite its migration receipt", async () => {
    await db.query("BEGIN");
    await db.query("ALTER TABLE maria_service_card_translations DROP COLUMN service_id CASCADE");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_card_translations_columns");
    expect(result.blockers).toContain("invalid_card_translations_pk");
    expect(result.blockers).toContain("invalid_card_translations_fk");
    expect(result.appliedMigrations).toContain("20261107_0074");
  });

  it("rejects missing actual primary and cascading foreign keys", async () => {
    await db.query("BEGIN");
    await db.query("ALTER TABLE maria_manual_closed_starts DROP CONSTRAINT maria_manual_closed_starts_pk");
    await db.query("ALTER TABLE maria_service_card_translations DROP CONSTRAINT maria_service_card_translations_service_id_fkey");
    const result = await inspect();
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_manual_closed_pk");
    expect(result.blockers).toContain("invalid_card_translations_fk");
  });
});
