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
vi.mock("@/lib/db/server", () => ({ getSql: () => runtime.makeSql?.() ?? null }));
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
import { sendMariaBookingStatusEmail } from "@/features/email/maria-deposit-email";
import { createDashboardAvailabilityBlock } from "@/lib/dashboard-availability-blocks";

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
  // Fixed daytime UTC avoids being later than the Stockholm 23:59 close.
  const future = new Date(Date.now() + 21 * 86_400_000);
  const start = new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 10));
  const end = new Date(start.getTime() + 180 * 60_000);
  const overlappingStart = new Date(start.getTime() + 30 * 60_000);
  const overlappingEnd = new Date(end.getTime() + 30 * 60_000);

  beforeAll(async () => {
    runtime.workspaceId = workspaceId;
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", customerEmail);
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", customerEmail);
    vi.stubEnv("VERCEL_URL", "maria-synthetic-qa.vercel.app");
    vi.stubEnv("BREVO_API_KEY", "synthetic-brevo-key");
    vi.stubEnv("LEAD_FROM_EMAIL", "Maria Test <noreply@example.invalid>");

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
    const stockholmDay = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Stockholm", weekday: "short",
    }).format(start);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(stockholmDay);
    await db.query(
      "insert into workspace_booking_hours(workspace_id,weekday,opens_at,closes_at,is_closed) values($1,$2,'00:00','23:59',false)",
      [workspaceId,weekday],
    );
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
    vi.unstubAllGlobals();
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
      "update public_booking_verifications set created_at=now()-interval '1 hour', expires_at=now()-interval '1 minute' where id=$1::uuid",
      [hold.rows[0]!.id],
    );
    // A manually closed start must not be resurrected by the manager.
    await db!.query(
      "insert into maria_manual_closed_starts(workspace_id,starts_at,created_by) values($1::uuid,$2::timestamptz,'synthetic-test')",
      [workspaceId,start.toISOString()],
    );
    expect((await updateDashboardBookingStatus(cancelledBookingId, "confirmed")).changed).toBe(false);
    expect(await readStatus()).toBe("cancelled");
    await db!.query("delete from maria_manual_closed_starts where workspace_id=$1::uuid", [workspaceId]);
    await db!.query("update workspace_booking_hours set is_closed=true where workspace_id=$1", [workspaceId]);
    const blockedReactivation = await updateDashboardBookingStatus(cancelledBookingId, "requested");
    expect(blockedReactivation.changed).toBe(false);
    expect(blockedReactivation.previousStatus).toBe("cancelled");
    expect(await readStatus()).toBe("cancelled");
    await db!.query("update workspace_booking_hours set is_closed=false where workspace_id=$1", [workspaceId]);

    const revived = await updateDashboardBookingStatus(cancelledBookingId, "confirmed");
    expect(revived.changed).toBe(true);
    expect(revived.notification?.customerEmail).toBe(customerEmail);
    const persisted = await db!.query<{ created_at: Date }>(
      "select created_at from customer_events where workspace_id=$1 and booking_id=$2::uuid and event_type='status_change' and metadata->>'new_status'='confirmed' order by created_at desc,id desc limit 1",
      [workspaceId, cancelledBookingId],
    );
    expect(persisted.rows).toHaveLength(1);
    expect(Math.abs(new Date(revived.notification?.confirmedAt ?? "").getTime()
      - new Date(persisted.rows[0]!.created_at).getTime())).toBeLessThan(1_000);
    expect(await readStatus()).toBe("confirmed");
    expect(await countEvents()).toBe(1);
    const noOp = await updateDashboardBookingStatus(cancelledBookingId, "confirmed");
    expect(noOp.changed).toBe(false);
    expect(noOp.previousStatus).toBe("confirmed");
    expect(await countEvents()).toBe(1);
  });
  it("rejects a single Maria block when a confirmed appointment appears after preflight", async () => {
    // Simulate a stale initial preflight: a booking is already committed by
    // the time the insert runs under Maria's workspace advisory lock.
    const originalFactory = runtime.makeSql;
    if (!originalFactory) throw new Error("Synthetic PostgreSQL client not ready");
    let stalePreflights = 0;
    runtime.makeSql = () => {
      const base = originalFactory() as {
        (parts: TemplateStringsArray, ...values: unknown[]): unknown;
        transaction: (queries: Query[]) => Promise<Rows[]>;
      };
      const tagged = (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = compileSql(parts, values);
        if (/select\s+id\s+from\s+bookings/u.test(query.text)
          && /status\s+not\s+in/u.test(query.text)) {
          stalePreflights += 1;
          return Promise.resolve([] as Rows);
        }
        return base(parts, ...values);
      };
      return Object.assign(tagged, { transaction: base.transaction });
    };

    const toStockholmLocal = (value: Date) => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(value).filter(part => part.type !== "literal")
          .map(part => [part.type, part.value]),
      );
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    };

    const count = async () => Number((await db!.query<{ count: number }>(
      "select count(*)::int as count from bookings where workspace_id=$1 and source='dashboard_availability_block'",
      [workspaceId],
    )).rows[0]?.count ?? 0);
    const beforeCount = await count();
    try {
      await expect(createDashboardAvailabilityBlock({
        localStartsAt: toStockholmLocal(start),
        localEndsAt: toStockholmLocal(end),
        reason: "Synthetic concurrent booking guard",
      })).rejects.toMatchObject({ code: "conflict" });
      expect(stalePreflights).toBe(1);
      expect(await count()).toBe(beforeCount);
    } finally {
      runtime.makeSql = originalFactory;
    }
  });

  it("rejects stale confirmed/cancelled emails using actual saved booking status", async () => {
    const services = await db!.query<{ id: string }>(
      "select id::text from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026' limit 1",
      [workspaceId],
    );
    const serviceId = services.rows[0]!.id;
    // Canonical public-booking triggers reject overlaps, even in synthetic fixtures.
    // Use two other future weeks on the already-configured weekday.
    const cancelledStart = new Date(start.getTime() + 7 * 86_400_000);
    const cancelledEnd = new Date(end.getTime() + 7 * 86_400_000);
    const confirmedStart = new Date(start.getTime() + 14 * 86_400_000);
    const confirmedEnd = new Date(end.getTime() + 14 * 86_400_000);
    const rows = await db!.query<{ id: string; status: string }>(
      `insert into bookings(workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at)
       values
        ($1,$2::uuid,$3::uuid,'Synthetic stale cancelled','Brudsmink med prov 2026','cancelled','public_booking',$4::timestamptz,$5::timestamptz),
        ($1,$2::uuid,$3::uuid,'Synthetic stale confirmed','Brudsmink med prov 2026','confirmed','public_booking',$6::timestamptz,$7::timestamptz)
       returning id::text,status`,
      [workspaceId, customerId, serviceId, cancelledStart.toISOString(), cancelledEnd.toISOString(),
        confirmedStart.toISOString(), confirmedEnd.toISOString()],
    );
    const cancelledId = rows.rows.find(row => row.status === "cancelled")!.id;
    const confirmedId = rows.rows.find(row => row.status === "confirmed")!.id;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      bookingId: cancelledId,
      status: "confirmed" as const,
      customerName: "Synthetic QA Customer",
      customerEmail,
      companyName: "Synthetic Maria",
      service: "Brudsmink med prov 2026",
      startsAt: cancelledStart.toISOString(),
      endsAt: cancelledEnd.toISOString(),
      city: "Södertälje",
      timeZone: "Europe/Stockholm" as const,
    };
    try {
      expect((await db!.query<{ status: string }>(
        "select status from bookings where id=$1::uuid", [cancelledId],
      )).rows[0]?.status).toBe("cancelled");
      expect(await sendMariaBookingStatusEmail(input))
        .toEqual({ ok: false, error: "invalid_booking" });
      expect((await db!.query<{ status: string }>(
        "select status from bookings where id=$1::uuid", [confirmedId],
      )).rows[0]?.status).toBe("confirmed");
      expect(await sendMariaBookingStatusEmail({
        ...input, bookingId: confirmedId, status: "cancelled",
        startsAt: confirmedStart.toISOString(), endsAt: confirmedEnd.toISOString(),
      })).toEqual({ ok: false, error: "invalid_booking" });
      expect(fetchMock).not.toHaveBeenCalled();
      // A matching stored status MUST reach the sender. This positive control
      // proves the two negative cases above failed because of status mismatch,
      // not an unrelated SQL error or missing workspace state.
      fetchMock.mockResolvedValue({ ok: true });
      expect(await sendMariaBookingStatusEmail({
        ...input, bookingId: confirmedId, status: "confirmed",
        startsAt: confirmedStart.toISOString(), endsAt: confirmedEnd.toISOString(),
      })).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(request[0]).toBe("https://api.brevo.com/v3/smtp/email");
      const sent = JSON.parse(String(request[1].body)) as {
        to: Array<{email: string}>; textContent: string;
      };
      expect(sent.to[0]?.email).toBe(customerEmail);
      expect(sent.textContent).toContain("MBM-");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("waits for Maria's advisory lock before a single-block insert and rejects a newly committed booking", async () => {
    const service = await db!.query<{ id: string }>(
      "select id::text from workspace_services where workspace_id=$1 and public_slug='maria-bridal-trial-2026' limit 1",
      [workspaceId],
    );
    const serviceId = service.rows[0]!.id;
    const blockStart = new Date(start.getTime() + 3 * 86_400_000);
    const blockEnd = new Date(blockStart.getTime() + 60 * 60_000);
    const stockholmLocal = (value: Date) => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit",
          day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }).formatToParts(value).filter(part => part.type !== "literal")
          .map(part => [part.type, part.value]),
      );
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    };
    const countBlocks = async () => Number((await db!.query<{ count: number }>(
      "select count(*)::int as count from bookings where workspace_id=$1 and source='dashboard_availability_block'",
      [workspaceId],
    )).rows[0]?.count ?? 0);

    const original = await countBlocks();
    const holder = new Client({ connectionString });
    await holder.connect();
    let committed = false;
    let attempted: Promise<{ ok: boolean; error?: unknown }> | undefined;
    let observedWait = false;
    try {
      await holder.query("begin");
      await holder.query("select pg_advisory_xact_lock(hashtextextended($1::text,713))", [workspaceId]);
      await holder.query(
        `insert into bookings(workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at)
         values($1,$2::uuid,$3::uuid,'Synthetic competing pending booking','Brudsmink med prov 2026','confirmed','dashboard_manual',$4::timestamptz,$5::timestamptz)`,
        [workspaceId, customerId, serviceId, blockStart.toISOString(), blockEnd.toISOString()],
      );
      // Its preflight cannot see the uncommitted booking, but the write must
      // queue on lock 713 instead of racing past the pending confirmation.
      attempted = createDashboardAvailabilityBlock({
        localStartsAt: stockholmLocal(blockStart),
        localEndsAt: stockholmLocal(blockEnd),
        reason: "Concurrent confirmed booking in flight",
      }).then(() => ({ ok: true }), (error: unknown) => ({ ok: false, error }));
      for (let attempt = 0; attempt < 60; attempt++) {
        const activity = await db!.query<{ waiting: number }>(
          `select count(*)::int as waiting from pg_stat_activity
           where datname=current_database() and pid<>pg_backend_pid()
             and wait_event_type='Lock' and wait_event='advisory'`,
        );
        if (Number(activity.rows[0]?.waiting ?? 0) > 0) {
          observedWait = true;
          break;
        }
        await delay(100);
      }
      await holder.query("commit");
      committed = true;
      const result = await attempted;
      expect(observedWait).toBe(true);
      expect(result).toMatchObject({ ok: false, error: { code: "conflict" } });
      expect(await countBlocks()).toBe(original);
    } finally {
      if (!committed) await holder.query("rollback").catch(() => undefined);
      await holder.end();
      if (attempted) await attempted.catch(() => undefined);
    }
  });

});
