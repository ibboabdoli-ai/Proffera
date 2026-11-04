import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

type Query = { text: string; values: unknown[] };
type Rows = Record<string, unknown>[];

const runtime = vi.hoisted(() => ({
  workspaceId: "",
  makeSql: undefined as undefined | (() => unknown),
}));
vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => runtime.makeSql?.() ?? null,
}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic-test-only.invalid",
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true,
    workspaceId: runtime.workspaceId,
    workspaceSlug: "makeup-by-maria",
    role: "owner",
    userId: "maria-test-owner",
  }),
  canManageWorkspaceSettings: (access: { ok: boolean; role: string }) =>
    access.ok && (access.role === "owner" || access.role === "admin"),
}));
vi.mock("@/lib/verified-review-email-delivery", () => ({
  deliverVerifiedReviewInvitation: vi.fn(),
}));

import { updateDashboardBookingStatus } from "@/lib/dashboard-booking-status";

const RUN = process.env.GITHUB_ACTIONS === "true" ||
  process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function compileSql(parts: TemplateStringsArray, values: unknown[]): Query {
  let text = parts[0] ?? "";
  for (let i = 0; i < values.length; i++) text += "$" + (i + 1) + (parts[i + 1] ?? "");
  return { text, values };
}

(RUN ? describe.sequential : describe.skip)("Maria Preview reactivation against canonical PostgreSQL", () => {
  let container = "";
  let connectionString = "";
  let db: Client | undefined;

  const workspaceId = randomUUID();
  const customerId = randomUUID();
  const cancelledBookingId = randomUUID();
  const competingBookingId = randomUUID();
  const customerEmail = "qa@example.invalid";
  const start = new Date(Date.now() + 21 * 86_400_000);
  const end = new Date(start.getTime() + 180 * 60_000);
  const overlappingStart = new Date(start.getTime() + 30 * 60_000);
  const overlappingEnd = new Date(end.getTime() + 30 * 60_000);

  beforeAll(async () => {
    runtime.workspaceId = workspaceId;
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", customerEmail);
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", customerEmail);

    container = "proffera-maria-reactivation-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port", container, "5432/tcp"])
      .split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error("Maria reactivation PostgreSQL port missing");
    connectionString = "postgres://postgres:postgres@127.0.0.1:" +
      port + "/proffera_test";
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const check = new Client({ connectionString });
      try {
        await check.connect();
        await check.query("select 1");
        await check.end();
        ready = true;
        break;
      } catch {
        await check.end().catch(() => undefined);
        await delay(500);
      }
    }
    if (!ready) throw new Error("Maria reactivation database not ready");

    db = new Client({ connectionString });
    await db.connect();
    await applyCanonicalProfferaMigrations(db);
    runtime.makeSql = () => Object.assign(
      (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = compileSql(parts, values);
        return Object.assign(query, {
          then: (resolve: (rows: Rows) => unknown, reject: (error: unknown) => unknown) =>
            db!.query(query.text, query.values).then(result => resolve(result.rows as Rows), reject),
        });
      },
      { transaction: async (queries: Query[]) => {
        const tx = new Client({ connectionString });
        await tx.connect();
        try {
          await tx.query("BEGIN");
          const result: Rows[] = [];
          for (const query of queries) {
            result.push((await tx.query(query.text, query.values)).rows as Rows);
          }
          await tx.query("COMMIT");
          return result;
        } catch (error) {
          await tx.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          await tx.end();
        }
      } },
    );

    await db.query(
      "insert into workspaces(id,slug,name,status,public_booking_slug) values($1::uuid,'makeup-by-maria','Synthetic Maria','active','makeup-by-maria')",
      [workspaceId],
    );
    await db.query(
      "insert into customers(id,workspace_id,name,email,status,source) values($1::uuid,$2,'Synthetic customer',$3,'active','dashboard_manual')",
      [customerId, workspaceId, customerEmail],
    );
    const services = await db.query<{ id: string }>(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,is_active,public_status) values($1,'Brudsmink med prov 2026','maria-bridal-trial-2026',180,true,'published') returning id::text",
      [workspaceId],
    );
    const serviceId = services.rows[0]!.id;
    // A cancelled appointment does not reserve its old slot; another customer
    // can take an overlapping real appointment after cancellation.
    await db.query(
      "insert into bookings(id,workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at) values($1::uuid,$2,$3::uuid,$4::uuid,'Cancelled Maria booking','Brudsmink med prov 2026','cancelled','dashboard_manual',$5::timestamptz,$6::timestamptz)",
      [cancelledBookingId, workspaceId, customerId, serviceId, start.toISOString(), end.toISOString()],
    );
    await db.query(
      "insert into bookings(id,workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at) values($1::uuid,$2,$3::uuid,$4::uuid,'Competing confirmed booking','Brudsmink med prov 2026','confirmed','dashboard_manual',$5::timestamptz,$6::timestamptz)",
      [competingBookingId, workspaceId, customerId, serviceId, overlappingStart.toISOString(), overlappingEnd.toISOString()],
    );
  }, 180_000);

  afterAll(async () => {
    runtime.makeSql = undefined;
    vi.unstubAllEnvs();
    await db?.end().catch(() => undefined);
    if (container) {
      try { docker(["stop", container]); } catch { /* already stopped */ }
    }
  }, 30_000);

  it("rejects overlapping active bookings and OTP holds, but allows the free slot", async () => {
    const readStatus = async () => {
      const result = await db!.query<{ status: string }>(
        "select status from bookings where workspace_id=$1 and id=$2::uuid",
        [workspaceId, cancelledBookingId],
      );
      return result.rows[0]?.status;
    };
    const countEvents = async () => {
      const result = await db!.query<{ count: number }>(
        "select count(*)::int as count from customer_events where workspace_id=$1 and booking_id=$2::uuid and event_type='status_change'",
        [workspaceId, cancelledBookingId],
      );
      return Number(result.rows[0]?.count);
    };
    expect((await updateDashboardBookingStatus(cancelledBookingId, "confirmed")).changed).toBe(false);
    expect(await readStatus()).toBe("cancelled");
    expect(await countEvents()).toBe(0);

    await db!.query("update bookings set status='cancelled' where id=$1::uuid",
      [competingBookingId]);
    const service = await db!.query<{ id: string }>(
      "select id::text from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026'",
      [workspaceId],
    );
    const hold = await db!.query<{ id: string }>(
      "insert into public_booking_verifications(workspace_id,public_booking_slug,customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at) values($1::uuid,'makeup-by-maria','Synthetic customer',$2,$3::uuid,'Brudsmink med prov 2026',$4::timestamptz,$5::timestamptz,'synthetic-hash',now()+interval '20 minutes') returning id::text",
      [workspaceId, customerEmail, service.rows[0]!.id, start.toISOString(), end.toISOString()],
    );
    expect((await updateDashboardBookingStatus(cancelledBookingId, "requested")).changed).toBe(false);
    expect(await readStatus()).toBe("cancelled");
    expect(await countEvents()).toBe(0);

    await db!.query(
      "update public_booking_verifications set expires_at=now()-interval '1 minute' where id=$1::uuid",
      [hold.rows[0]!.id],
    );
    const revived = await updateDashboardBookingStatus(cancelledBookingId, "confirmed");
    expect(revived.changed).toBe(true);
    expect(revived.notification?.customerEmail).toBe(customerEmail);
    expect(await readStatus()).toBe("confirmed");
    expect(await countEvents()).toBe(1);
  });
});
