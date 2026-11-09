import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

type Query = { text: string; values: unknown[] };
const runtime = vi.hoisted(() => ({
  databaseUrl: "",
  workspaceId: "",
  makeSql: undefined as undefined | (() => unknown),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic-isolated-pg-test.invalid",
  resolveNodePostgresDatabaseUrl: () => runtime.databaseUrl,
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => runtime.makeSql?.() ?? null,
}));
vi.mock("@/lib/auth-secret", () => ({
  resolveCustomerPortalSecret: () => "synthetic-only-customer-portal-token-secret",
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceId: runtime.workspaceId, workspaceSlug: "makeup-by-maria",
    workspaceName: "Synthetic Maria", role: "owner",
  }),
  canManageWorkspaceSettings: () => true,
}));
vi.mock("@/features/email/booking-change-email", () => ({
  sendBookingChangeEmails: vi.fn(async () => [
    { status: "fulfilled", value: { ok: true } },
    { status: "fulfilled", value: { ok: true } },
  ]),
}));

import {
  cancelCustomerCalendarBooking,
  createCustomerCalendarToken,
  getCustomerCalendar,
} from "@/lib/customer-calendar";
import { getBookingReminderSettings } from "@/lib/booking-reminder-settings";
import { sendBookingChangeEmails } from "@/features/email/booking-change-email";

const RUN = process.env.GITHUB_ACTIONS === "true" || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";
function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}
function compileSql(parts: TemplateStringsArray, values: unknown[]): Query {
  let sql = parts[0] ?? "";
  for (let index = 0; index < values.length; index++) {
    sql += "$" + (index + 1) + (parts[index + 1] ?? "");
  }
  return { text: sql, values };
}

(RUN ? describe.sequential : describe.skip)("Maria existing-booking lifecycle and migration 0075, isolated PostgreSQL", () => {
  let container = "";
  let databaseUrl = "";
  let db: Client | undefined;
  const workspaceId = randomUUID();
  let customerId = "";
  let bookingId = "";
  let token = "";

  beforeAll(async () => {
    container = "proffera-maria-lifecycle-contract-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port", container, "5432/tcp"])
      .split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error("Isolated Maria PostgreSQL port missing");
    databaseUrl = "postgres://postgres:postgres@127.0.0.1:" + port + "/proffera_test";
    runtime.databaseUrl = databaseUrl;

    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const probe = new Client({ connectionString: databaseUrl });
      try {
        await probe.connect();
        await probe.query("select 1");
        ready = true;
        await probe.end();
        break;
      } catch {
        await probe.end().catch(() => undefined);
        await delay(500);
      }
    }
    if (!ready) throw new Error("Isolated PostgreSQL unavailable");
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
    await applyCanonicalProfferaMigrations(db);
    await db.query(
      "insert into workspaces(id,slug,name,status,public_booking_slug) values($1::uuid,'makeup-by-maria','Synthetic Maria','active','makeup-by-maria')",
      [workspaceId],
    );
    await db.query(
      "insert into workspace_settings(workspace_id,company_name,contact_email,time_zone,billing_currency) values($1,'Synthetic Maria','maria@example.invalid','Europe/Stockholm','SEK') on conflict(workspace_id) do update set contact_email=excluded.contact_email",
      [workspaceId],
    );

    // Use the canonical published service contract: the real public_booking
    // trigger refuses an appointment whose stored service has no active row.
    const serviceYear = new Date(Date.now() + 35 * 86_400_000).getUTCFullYear();
    await db.query(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,buffer_before_minutes,buffer_after_minutes,minimum_notice_minutes,maximum_advance_days,is_active,public_status,price_type,price_amount_minor) values($1,'Synthetic makeup',$2,120,0,0,0,730,true,'published','fixed',690000)",
      [workspaceId, "maria-bridal-trial-" + serviceYear],
    );

    runtime.workspaceId = workspaceId;
    runtime.makeSql = () => Object.assign(
      (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = compileSql(parts, values);
        return Object.assign(query, {
          then: (
            resolve: (rows: Record<string, unknown>[]) => unknown,
            reject: (error: unknown) => unknown,
          ) => db!.query(query.text, query.values)
            .then(result => resolve(result.rows as Record<string, unknown>[]), reject),
        });
      },
      {
        transaction: async (queries: Query[]) => {
          const tx = new Client({ connectionString: databaseUrl });
          await tx.connect();
          try {
            await tx.query("BEGIN");
            const results: Record<string, unknown>[][] = [];
            for (const query of queries) {
              results.push((await tx.query(query.text, query.values)).rows);
            }
            await tx.query("COMMIT");
            return results;
          } catch (error) {
            await tx.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            await tx.end();
          }
        },
      },
    );
  }, 180_000);

  afterAll(async () => {
    runtime.makeSql = undefined;
    await db?.end().catch(() => undefined);
    if (container) {
      try { docker(["stop", container]); } catch { /* --rm cleans the test container */ }
    }
  }, 30_000);

  beforeEach(async () => {
    vi.clearAllMocks();
    runtime.databaseUrl = databaseUrl;
    customerId = randomUUID();
    bookingId = randomUUID();
    const startsAt = new Date(Date.now() + 35 * 86_400_000).toISOString();
    const endsAt = new Date(Date.parse(startsAt) + 2 * 3_600_000).toISOString();
    await db!.query(
      "insert into customers(id,workspace_id,name,email,status,source) values($1::uuid,$2,'Synthetic Bride','bride@example.invalid','active','dashboard_manual')",
      [customerId, workspaceId],
    );
    await db!.query(
      "insert into bookings(id,workspace_id,customer_id,title,service,status,source,starts_at,ends_at) values($1::uuid,$2,$3::uuid,'Synthetic appointment','Synthetic makeup','confirmed','public_booking',$4::timestamptz,$5::timestamptz)",
      [bookingId, workspaceId, customerId, startsAt, endsAt],
    );
    await db!.query(
      "insert into workspace_booking_reminder_settings(workspace_id,customer_reschedule_enabled,customer_cancel_enabled,cancel_notice_hours,no_show_enabled,auto_complete_enabled,company_confirmation_required) values($1,false,true,24,false,false,true) on conflict(workspace_id) do update set customer_reschedule_enabled=false,customer_cancel_enabled=true,cancel_notice_hours=24,no_show_enabled=false,auto_complete_enabled=false,company_confirmation_required=true",
      [workspaceId],
    );

    token = createCustomerCalendarToken({ workspaceId, customerId });
    const flags: Record<string, string> = {
      VERCEL_ENV: "production",
      PROFFERA_MARIA_PUBLIC_SITE_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "false",
      PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_ORIGIN: "https://makeupbymaria.se",
    };
    for (const [key, value] of Object.entries(flags)) vi.stubEnv(key, value);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await db!.query("delete from customer_events where booking_id=$1::uuid", [bookingId]);
    await db!.query("delete from bookings where id=$1::uuid", [bookingId]);
    await db!.query("delete from customers where id=$1::uuid", [customerId]);
  });

  it("reads all six canonical migration 0075 lifecycle settings through the real reader", async () => {
    const ledger = await db!.query(
      "select migration_key from proffera_schema_migrations where migration_key='20261108_0075'",
    );
    expect(ledger.rowCount).toBe(1);
    const result = await getBookingReminderSettings();
    expect(result).toMatchObject({
      customerRescheduleEnabled: false,
      customerCancelEnabled: true,
      cancelNoticeHours: 24,
      noShowEnabled: false,
      autoCompleteEnabled: false,
      companyConfirmationRequired: true,
    });
  });

  it("cancels an existing booking through the real backend while new intake is paused", async () => {
    const before = await getCustomerCalendar(token);
    expect(before?.upcoming.some(booking => booking.id === bookingId)).toBe(true);
    expect(before?.policy.customerCancelEnabled).toBe(true);
    expect(await cancelCustomerCalendarBooking(token, bookingId, "sv")).toEqual({ ok: true });
    const cancelled = await db!.query<{ status: string }>(
      "select status from bookings where id=$1::uuid and workspace_id=$2", [bookingId, workspaceId],
    );
    expect(cancelled.rows[0]?.status).toBe("cancelled");
    const event = await db!.query<{ state: string }>(
      "select metadata->>'notice_customer' as state from customer_events where booking_id=$1::uuid and event_type='status_change' order by created_at desc limit 1",
      [bookingId],
    );
    expect(event.rows[0]?.state).toBe("accepted");
    expect(vi.mocked(sendBookingChangeEmails)).toHaveBeenCalledOnce();
  });

  it("sends to a normalized customer with vertical-tab and NBSP padding, using the exact DB snapshot", async () => {
    const padded = "\u000b\u00a0BRIDE@example.invalid\u00a0\t";
    await db!.query(
      "update customers set email=$1 where id=$2::uuid and workspace_id=$3",
      [padded, customerId, workspaceId],
    );
    expect(await cancelCustomerCalendarBooking(token, bookingId, "en")).toEqual({ ok: true });
    expect(vi.mocked(sendBookingChangeEmails)).toHaveBeenCalledWith(
      expect.objectContaining({ customerEmail: "BRIDE@example.invalid" }),
    );
    const event = await db!.query<{ state: string }>(
      "select metadata->>'notice_customer' as state from customer_events where booking_id=$1::uuid and event_type='status_change' order by created_at desc limit 1",
      [bookingId],
    );
    expect(event.rows[0]?.state).toBe("accepted");
  });

  it("keeps cancellation notice uncertain when a provider request may have been accepted", async () => {
    vi.mocked(sendBookingChangeEmails).mockResolvedValueOnce([
      {status:"fulfilled",value:{ok:false,deliveryUncertain:true}},
      {status:"fulfilled",value:{ok:true}},
    ] as Awaited<ReturnType<typeof sendBookingChangeEmails>>);
    expect(await cancelCustomerCalendarBooking(token, bookingId, "en")).toEqual({ok:true});
    const state = await db!.query<{customer:string;owner:string}>(
      `select metadata->>'notice_customer' as customer,
         metadata->>'notice_owner' as owner
       from customer_events where booking_id=$1::uuid and event_type='status_change'
       order by created_at desc limit 1`, [bookingId],
    );
    expect(state.rows[0]).toMatchObject({customer:"uncertain",owner:"accepted"});
  });

  it("rejects cancellation after lifecycle authorization is revoked without changing the booking", async () => {
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED", "false");
    expect(await cancelCustomerCalendarBooking(token, bookingId, "sv"))
      .toMatchObject({ ok: false, error: "not_allowed" });
    const booking = await db!.query<{ status: string }>(
      "select status from bookings where id=$1::uuid and workspace_id=$2", [bookingId, workspaceId],
    );
    expect(booking.rows[0]?.status).toBe("confirmed");
    expect(vi.mocked(sendBookingChangeEmails)).not.toHaveBeenCalled();
  });
});
