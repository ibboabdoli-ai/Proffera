import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

// Do not mock getSql() or the booking query. Only bridge Neon's HTTP transport
// to real PostgreSQL, preserving the same single-session transaction semantics.
type Query = { text: string; values: unknown[] };
const bridge = vi.hoisted(() => ({ makeSql: undefined as undefined | (() => unknown) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgres://maria-resend-integration.invalid/local",
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    if (!bridge.makeSql) throw new Error("PostgreSQL bridge unavailable");
    return bridge.makeSql();
  },
}));

import { renewMariaPreviewHoldForResend } from "@/lib/maria-resend-hold";

const RUN = process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";
const workspaceId = randomUUID();
const serviceId = randomUUID();
const verificationId = randomUUID();

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}
function compileSql(strings: TemplateStringsArray, values: unknown[]): Query {
  let text = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) text += "$" + (i + 1) + (strings[i + 1] ?? "");
  return { text, values };
}

(RUN ? describe.sequential : describe.skip)("Maria resend PostgreSQL real overlap", () => {
  let container = "";
  let url = "";
  let db: Client | undefined;
  let startsAt = "";
  let endsAt = "";

  beforeAll(async () => {
    container = "proffera-maria-resend-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const portLine = docker(["port", container, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
    const port = portLine.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error("PostgreSQL port missing: " + portLine);
    url = "postgres://postgres:postgres@127.0.0.1:" + port + "/proffera_test";
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const probe = new Client({ connectionString: url });
      try {
        await probe.connect(); await probe.query("select 1"); ready = true;
        await probe.end(); break;
      } catch {
        await probe.end().catch(() => undefined); await delay(500);
      }
    }
    if (!ready) throw new Error("PostgreSQL never became ready");
    db = new Client({ connectionString: url }); await db.connect();
    await applyCanonicalProfferaMigrations(db);

    bridge.makeSql = () => Object.assign(
      (parts: TemplateStringsArray, ...values: unknown[]) => compileSql(parts, values),
      { transaction: async (queries: Query[]) => {
        const tx = new Client({ connectionString: url });
        await tx.connect();
        try {
          await tx.query("BEGIN");
          const rows: Record<string, unknown>[][] = [];
          for (const query of queries) {
            const result = await tx.query(query.text, query.values);
            rows.push(result.rows as Record<string, unknown>[]);
          }
          await tx.query("COMMIT"); return rows;
        } catch (error) {
          await tx.query("ROLLBACK").catch(() => undefined); throw error;
        } finally { await tx.end(); }
      } },
    );

    await db.query(
      "insert into workspaces (id,slug,public_booking_slug,name,status) values ($1::uuid,'makeup-by-maria','makeup-by-maria','Maria QA','active')",
      [workspaceId]);
    await db.query(
      "insert into workspace_services (id,workspace_id,name,public_slug,public_status,is_active,duration_minutes,minimum_notice_minutes,maximum_advance_days,buffer_before_minutes,buffer_after_minutes) values ($1::uuid,$2,'Maria QA Service','maria-bridal-trial-2026','published',true,60,0,365,0,0)",
      [serviceId, workspaceId]);
    const slot = await db.query<{ starts_at: Date; ends_at: Date; weekday: number }>(`select ((date_trunc('day',now() at time zone 'Europe/Stockholm') + interval '3 days 12 hours') at time zone 'Europe/Stockholm') as starts_at, ((date_trunc('day',now() at time zone 'Europe/Stockholm') + interval '3 days 13 hours') at time zone 'Europe/Stockholm') as ends_at, extract(dow from (now() at time zone 'Europe/Stockholm') + interval '3 days')::int as weekday`);
    startsAt = slot.rows[0]!.starts_at.toISOString();
    endsAt = slot.rows[0]!.ends_at.toISOString();
    await db.query(
      "insert into workspace_booking_hours (workspace_id,weekday,opens_at,closes_at,is_closed) values ($1,$2,'00:00','23:59',false)",
      [workspaceId, slot.rows[0]!.weekday]);
  }, 180_000);

  afterAll(async () => {
    bridge.makeSql = undefined;
    await db?.end().catch(() => undefined);
    if (container) { try { docker(["stop", container]); } catch { /* auto-removed */ } }
  }, 30_000);

  beforeEach(async () => {
    if (!db) throw new Error("PostgreSQL client missing");
    await db.query("delete from bookings where workspace_id=$1", [workspaceId]);
    await db.query("delete from public_booking_verifications where workspace_id=$1::uuid", [workspaceId]);
    await db.query(`insert into public_booking_verifications (id,workspace_id,public_booking_slug,customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at,created_at,updated_at) values ($1::uuid,$2::uuid,'makeup-by-maria','QA Customer','qa@example.invalid',$3::uuid,'Maria QA Service',$4::timestamptz,$5::timestamptz,'expired',now()-interval '1 minute',now()-interval '3 minutes',now()-interval '2 minutes')`,
      [verificationId, workspaceId, serviceId, startsAt, endsAt]);
  });

  const renew = () => renewMariaPreviewHoldForResend({
    workspaceId, verificationId, expectedCodeHash: "renewed",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });

  it("rejects a real overlapping confirmed booking and leaves the expired hold intact", async () => {
    await db!.query(`insert into bookings (workspace_id,service_id,title,service,starts_at,ends_at,status,source) values ($1,$2::uuid,'QA overlap','Maria QA Service',$3::timestamptz + interval '30 minutes',$4::timestamptz + interval '30 minutes','confirmed','manual')`,
      [workspaceId, serviceId, startsAt, endsAt]);
    expect(await renew()).toEqual({ ok: false, error: "conflict" });
    const result = await db!.query<{ code_hash: string }>(
      "select code_hash from public_booking_verifications where id=$1::uuid", [verificationId]);
    expect(result.rows[0]?.code_hash).toBe("expired");
  });

  it("accepts a genuinely free slot and persists the new hash", async () => {
    expect(await renew()).toEqual({ ok: true });
    const result = await db!.query<{ code_hash: string }>(
      "select code_hash from public_booking_verifications where id=$1::uuid", [verificationId]);
    expect(result.rows[0]?.code_hash).toBe("renewed");
  });

  it("allows an adjacent booking starting exactly at the hold end", async () => {
    await db!.query(`insert into bookings (workspace_id,service_id,title,service,starts_at,ends_at,status,source) values ($1,$2::uuid,'QA adjacent','Maria QA Service',$3::timestamptz,$3::timestamptz + interval '60 minutes','confirmed','manual')`,
      [workspaceId, serviceId, endsAt]);
    expect(await renew()).toEqual({ ok: true });
  });
});
