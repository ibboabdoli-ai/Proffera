import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const runtime = vi.hoisted(() => ({
  makeSql: undefined as undefined | (() => unknown),
  queries: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: () => runtime.makeSql?.() ?? null }));
vi.mock("@/lib/email-runtime-config", () => ({
  resolveBrevoApiKey: () => "synthetic-provider-key",
}));
vi.mock("@/lib/maria-preview-booking", () => ({
  getMariaPreviewBookingReadiness: async () => ({ enabled: false }),
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: vi.fn(async () => true),
}));

import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

const RUN = process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function compileSql(strings: TemplateStringsArray, values: unknown[]) {
  let text = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    text += "$" + (i + 1) + (strings[i + 1] ?? "");
  }
  return { text, values };
}

(RUN ? describe.sequential : describe.skip)("Maria runtime Production schema gate with real PostgreSQL", () => {
  let container = "";
  let db: Client | undefined;
  const workspaceId = randomUUID();

  beforeAll(async () => {
    container = "proffera-maria-runtime-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port", container, "5432/tcp"])
      .split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error("Maria runtime PostgreSQL port missing");
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
    if (!ready) throw new Error("Maria runtime PostgreSQL test unavailable");

    db = new Client({ connectionString });
    await db.connect();
    await applyCanonicalProfferaMigrations(db);
    await db.query(
      "insert into workspaces (id,slug,name,status,public_booking_slug) values ($1::uuid,'makeup-by-maria','Synthetic Maria Runtime','active','makeup-by-maria')",
      [workspaceId],
    );
    await db.query(
      "insert into workspace_settings (workspace_id,contact_email,time_zone,billing_currency) values ($1,'synthetic@example.invalid','Europe/Stockholm','SEK') on conflict (workspace_id) do update set contact_email=excluded.contact_email,time_zone=excluded.time_zone,billing_currency=excluded.billing_currency",
      [workspaceId],
    );
    await db.query(
      "insert into workspace_services (workspace_id,name,public_slug,duration_minutes,is_active,public_status,price_type,price_amount_minor) values ($1,'Synthetic bridal with trial','maria-bridal-trial-2026',180,true,'published','fixed',690000)",
      [workspaceId],
    );

    // Execute the actual runtime SQL template via a real isolated pg.Client.
    // No mock catalog booleans: malformed schema must be detected by PostgreSQL.
    runtime.makeSql = () => (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = compileSql(parts, values);
      runtime.queries.push(query.text);
      return db!.query(query.text, query.values).then(result => result.rows);
    };
  }, 180_000);

  afterAll(async () => {
    runtime.makeSql = undefined;
    await db?.end().catch(() => undefined);
    if (container) {
      try { docker(["stop", container]); } catch { /* --rm already stopped */ }
    }
  }, 30_000);

  beforeEach(() => {
    runtime.queries.length = 0;
    vi.clearAllMocks();
    const flags: Record<string, string> = {
      VERCEL_ENV: "production",
      PROFFERA_MARIA_PUBLIC_SITE_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_ORIGIN: "https://makeupbymaria.se",
      BETTER_AUTH_SECRET: "synthetic-test-auth-secret",
      LEAD_FROM_EMAIL: "Makeup by Maria <noreply@example.invalid>",
    };
    for (const [key, value] of Object.entries(flags)) vi.stubEnv(key, value);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await db?.query("ROLLBACK").catch(() => undefined);
  });

  it("accepts fully prepared Maria Production schema, owner and feature entitlement", async () => {
    expect(await getMariaBookingReadiness()).toMatchObject({ enabled: true, workspaceId });
    expect(runtime.queries).toHaveLength(4);
    expect(runtime.queries[1]).toContain("pg_constraint");
    expect(runtime.queries[1]).toContain("maria_manual_closed_starts");
    expect(hasWorkspaceFeatureAccessForWorkspace)
      .toHaveBeenCalledWith(workspaceId, "online_booking");
  });

  it("rejects a malformed 0072 table before any entitlement or booking check", async () => {
    await db!.query("BEGIN");
    await db!.query("ALTER TABLE maria_manual_closed_starts DROP COLUMN starts_at CASCADE");
    expect(await getMariaBookingReadiness()).toEqual({ enabled: false });
    expect(runtime.queries).toHaveLength(2);
    expect(hasWorkspaceFeatureAccessForWorkspace).not.toHaveBeenCalled();
  });

  it("rejects a malformed 0074 foreign key even when the migration is recorded", async () => {
    await db!.query("BEGIN");
    await db!.query("ALTER TABLE maria_service_card_translations DROP CONSTRAINT maria_service_card_translations_service_id_fkey");
    expect(await getMariaBookingReadiness()).toEqual({ enabled: false });
    expect(runtime.queries).toHaveLength(2);
    expect(hasWorkspaceFeatureAccessForWorkspace).not.toHaveBeenCalled();
  });
});
