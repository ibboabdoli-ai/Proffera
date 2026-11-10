import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client, Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

type Query = { text: string; values: unknown[] };
const runtime = vi.hoisted(() => ({
  makeSql: undefined as undefined | (() => unknown),
  workspaceId: "",
  databaseUrl: "",
  userId: "synthetic-maria-manager",
}));
vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: () => runtime.makeSql?.() ?? null }));
vi.mock("@/lib/db/database-url", () => ({
  resolveDatabaseUrl: () => "postgresql://synthetic-isolated-pg-test.invalid",
  resolveNodePostgresDatabaseUrl: () => runtime.databaseUrl,
}));
vi.mock("@/lib/db/server", () => ({ getSql: () => runtime.makeSql?.() ?? null }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: async (id: string) => id === runtime.workspaceId,
}));
vi.mock("@/lib/customer-calendar", () => ({
  createCustomerCalendarToken: () => "synthetic-customer-portal-token",
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, role: "owner", workspaceSlug: "makeup-by-maria",
    workspaceId: runtime.workspaceId, userId: runtime.userId,
    workspaceName: "Makeup by Maria",
  }),
  canManageWorkspaceSettings: (access: { ok: boolean; role: string }) =>
    access.ok && (access.role === "owner" || access.role === "admin"),
}));
vi.mock("@/lib/workspace-module-access", () => ({
  hasDashboardModuleAccess: async (id: string) => id === "online_booking",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/email/booking-change-email", () => ({ sendBookingChangeEmails: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("TEST_REDIRECT:" + url); } }));
vi.mock("@/features/sms/booking-sms", () => ({
  sendBookingVerificationSms: () => { throw new Error("Maria must never send verification SMS"); },
  sendBookingOwnerSms: () => { throw new Error("Maria must never send owner SMS"); },
}));

import { beginBookingEmailVerification, resendPublicBookingCode, verifyPublicBookingCode } from "@/lib/public-booking-verification";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { updateDashboardBookingStatus } from "@/lib/dashboard-booking-status";
import { setMariaManualSwishStatus, readMariaManualSwishStatuses } from "@/lib/maria-manual-swish";
import { readMariaSwishQrEligibility } from "@/lib/maria-swish-qr-eligibility";
import { mariaBookingNumber } from "@/lib/maria-deposit";
import { changeMariaManualCalendar } from "@/lib/maria-manual-calendar";
import { sendMariaBookingStatusEmail } from "@/features/email/maria-deposit-email";
import { sendBookingChangeEmails } from "@/features/email/booking-change-email";
import { retryMariaRescheduleNotice } from "@/lib/maria-reschedule-notice-retry";
import { withMariaBookingNotificationLock } from "@/lib/maria-booking-notification-lock";
import { getMariaStatusRetryGate, recordMariaStatusRetryAudit, claimMariaStatusRetry, finishMariaStatusRetry } from "@/lib/maria-status-retry-journal";

const RUN = process.env.GITHUB_ACTIONS === "true" || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";
function docker(args: string[]) { return execFileSync("docker", args, { encoding: "utf8" }).trim(); }
function compileSql(strings: TemplateStringsArray, values: unknown[]): Query {
  let text = strings[0] ?? "";
  for (let i=0;i<values.length;i++) text += "$" + (i + 1) + (strings[i + 1] ?? "");
  return { text, values };
}

(RUN ? describe.sequential : describe.skip)("Maria complete Production booking and manager lifecycle, real isolated PostgreSQL", () => {
  let container = "";
  let connectionString = "";
  let db: Client | undefined;
  let serviceId = "";
  let day = "";
  let startsAt = "";
  let endsAt = "";
  const workspaceId = randomUUID();

  beforeAll(async () => {
    runtime.workspaceId = workspaceId;
    container = "proffera-maria-live-cycle-" + process.pid + "-" + Date.now();
    docker(["run", "--rm", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_USER=postgres",
      "-e", "POSTGRES_DB=proffera_test", "-p", "127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const port = docker(["port", container, "5432/tcp"]).split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if (!port) throw Error("Isolated Maria PostgreSQL port missing");
    connectionString = "postgres://postgres:postgres@127.0.0.1:" + port + "/proffera_test";
    runtime.databaseUrl = connectionString;
    let ready = false;
    for(let attempt=0;attempt<80;attempt++) {
      const probe=new Client({connectionString});
      try { await probe.connect(); await probe.query("select 1"); await probe.end(); ready=true;break; }
      catch { await probe.end().catch(()=>undefined); await delay(500); }
    }
    if(!ready) throw Error("Isolated PostgreSQL unavailable");
    db=new Client({connectionString});await db.connect();
    await applyCanonicalProfferaMigrations(db);
    await db.query(
      "insert into workspaces(id,slug,name,status,public_booking_slug) values($1::uuid,'makeup-by-maria','Synthetic Maria Live','active','makeup-by-maria')",
      [workspaceId]);
    await db.query(
      "insert into workspace_settings(workspace_id,company_name,contact_email,time_zone,billing_currency) values($1,'Makeup by Maria','maria@example.invalid','Europe/Stockholm','SEK') on conflict(workspace_id) do update set contact_email=excluded.contact_email,time_zone=excluded.time_zone,billing_currency=excluded.billing_currency",
      [workspaceId]);
    const row=(await db.query<{day:string}>(`
      select to_char(current_date+21+((5-extract(dow from current_date)::int+7)%7),'YYYY-MM-DD') as day
    `)).rows[0];
    day=row!.day;
    const year=day.slice(0,4);
    const service=await db.query<{id:string}>(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,buffer_before_minutes,buffer_after_minutes,minimum_notice_minutes,maximum_advance_days,is_active,public_status,price_type,price_amount_minor) values($1,$2,$3,180,0,0,0,730,true,'published','fixed',690000) returning id::text",
      [workspaceId,"Brudmakeup med prov "+year,"maria-bridal-trial-"+year]);
    serviceId=service.rows[0]!.id;
    await db.query(
      "insert into workspace_booking_hours(workspace_id,weekday,opens_at,closes_at,is_closed) values($1,5,'08:00','18:00',false)",
      [workspaceId]);
    const time=await db.query<{starts_at:string;ends_at:string}>(
      "select (($1::timestamp at time zone 'Europe/Stockholm'))::text as starts_at, (($1::timestamp at time zone 'Europe/Stockholm')+interval '3 hours')::text as ends_at",
      [day+" 09:00"]);
    startsAt=new Date(time.rows[0]!.starts_at).toISOString();
    endsAt=new Date(time.rows[0]!.ends_at).toISOString();

    runtime.makeSql=()=>Object.assign(
      (parts:TemplateStringsArray,...values:unknown[])=>{
        const query=compileSql(parts,values);
        return Object.assign(query,{
          then:(resolve:(rows:Record<string,unknown>[])=>unknown,reject:(error:unknown)=>unknown)=>
            db!.query(query.text,query.values).then(result=>resolve(result.rows as Record<string,unknown>[]),reject),
        });
      },
      {transaction:async(queries:Query[])=>{
        const tx=new Client({connectionString});await tx.connect();
        try{
          await tx.query("BEGIN");const results:Record<string,unknown>[][]=[];
          for(const query of queries)results.push((await tx.query(query.text,query.values)).rows);
          await tx.query("COMMIT");return results;
        }catch(error){await tx.query("ROLLBACK").catch(()=>undefined);throw error;}
        finally{await tx.end();}
      }},
    );
  },180_000);
  afterAll(async()=>{
    runtime.makeSql=undefined;
    await db?.end().catch(()=>undefined);
    if(container){try{docker(["stop",container]);}catch{/* cleaned automatically */}}
  },30_000);

  // Exercise real PostgreSQL contention with independent connections.
  async function withParallelSql<T>(action: () => Promise<T>): Promise<T> {
    const pool = new Pool({ connectionString, max: 16 });
    const previous = runtime.makeSql;
    runtime.makeSql = () => (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = compileSql(parts, values);
      return Object.assign(query, {
        then: (resolve: (rows: Record<string, unknown>[]) => unknown, reject: (error: unknown) => unknown) =>
          pool.query(query.text, query.values).then(result => resolve(result.rows as Record<string, unknown>[]), reject),
      });
    };
    try { return await action(); }
    finally { runtime.makeSql = previous; await pool.end(); }
  }

  beforeEach(()=>{
    // Preserve the isolated Docker URL across all Vitest cases; the
    // notification lock runs on a dedicated PostgreSQL Client.
    runtime.databaseUrl = connectionString;
    const flags:Record<string,string>={
      VERCEL_ENV:"production",PROFFERA_MARIA_PUBLIC_SITE_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_ORIGIN:"https://makeupbymaria.se",
      PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED:"true",
      BREVO_API_KEY:"synthetic-production-email-key",
      LEAD_FROM_EMAIL:"Makeup by Maria <noreply@example.invalid>",
      BETTER_AUTH_SECRET:"synthetic-only-for-isolated-postgres-test",
    };
    for(const [key,value] of Object.entries(flags))vi.stubEnv(key,value);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(
      new Response(JSON.stringify({messageId:"synthetic-only"}),{status:201})));
  });
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

  it("serializes in-flight provider requests against booking writers on real PostgreSQL", async () => {
    let entered!: () => void;
    let release!: () => void;
    // Fail immediately on a fixture mismatch instead of hanging on
    // an unresolved provider gate while a detached promise rejects.
    expect(runtime.databaseUrl).toBe(connectionString);
    const acquired = new Promise<void>(resolve => { entered = resolve; });
    const delayedProvider = new Promise<void>(resolve => { release = resolve; });
    const first = withMariaBookingNotificationLock(workspaceId, async () => {
      entered();
      await delayedProvider;
      return "synthetic-provider-accepted";
    });
    await Promise.race([acquired, delay(5_000).then(() => { throw new Error("Maria synthetic lock entry timed out"); })]);
    const writer = new Client({ connectionString });
    let acquiredWriterLock = false;
    try {
      await writer.connect();
      await writer.query("BEGIN");
      const second = writer.query(
        "select pg_advisory_xact_lock(hashtextextended($1::text, 713))", [workspaceId],
      ).then(() => { acquiredWriterLock = true; });
      await delay(80);
      expect(acquiredWriterLock).toBe(false);
      release();
      expect(await first).toBe("synthetic-provider-accepted");
      await second;
      expect(acquiredWriterLock).toBe(true);
    } finally {
      release();
      await first.catch(() => undefined);
      await writer.query("ROLLBACK").catch(() => undefined);
      await writer.end().catch(() => undefined);
    }
  }, 30_000);


  it("expires a stalled notification lock and stops a late provider dispatch", async () => {
    let entered!: () => void;
    let release!: () => void;
    let sentAfterRelease = false;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const blockedQuery = new Promise<void>(resolve => { release = resolve; });
    const held = withMariaBookingNotificationLock(workspaceId, async (signal) => {
      entered();
      await blockedQuery;
      if (signal.aborted) return false;
      sentAfterRelease = true;
      return true;
    }, 250);
    try {
      await Promise.race([started, delay(4_000).then(() => { throw new Error("Synthetic lock entry failed"); })]);
      await expect(held).rejects.toThrow("Maria notification deadline exceeded");
      // A bounded failure releases the real PostgreSQL advisory lock.
      const probe = new Client({ connectionString });
      try {
        await probe.connect();
        await probe.query("BEGIN");
        const row = await probe.query<{ acquired: boolean }>(
          "select pg_try_advisory_xact_lock(hashtextextended($1::text,713)) as acquired",
          [workspaceId],
        );
        expect(row.rows[0]?.acquired).toBe(true);
      } finally {
        await probe.query("ROLLBACK").catch(() => undefined);
        await probe.end().catch(() => undefined);
      }
    } finally {
      release();
      await held.catch(() => undefined);
    }
    await delay(25);
    expect(sentAfterRelease).toBe(false);
  }, 12_000);

  it("rejects a second published quote, null-priced or zero-priced Maria package in real PostgreSQL", async () => {
    expect(await getMariaBookingReadiness()).toMatchObject({enabled:true,workspaceId});
    const year = day.slice(0,4);
    for (const [priceType,amount] of [["from",550000],[null,null],[null,550000],["fixed",0]] as const) {
      const id = (await db!.query<{id:string}>(
        `insert into workspace_services
           (workspace_id,name,public_slug,duration_minutes,buffer_before_minutes,
            buffer_after_minutes,minimum_notice_minutes,maximum_advance_days,
            is_active,public_status,price_type,price_amount_minor)
         values($1,'Synthetic unsafe second package',$2,180,0,0,0,730,true,'published',$3,$4)
         returning id::text`,
        [workspaceId,`maria-bridal-without-trial-${year}`,priceType,amount],
      )).rows[0]!.id;
      try {
        expect(await getMariaBookingReadiness()).toEqual({enabled:false});
      } finally {
        await db!.query("delete from workspace_services where id=$1::uuid",[id]);
      }
    }
    expect(await getMariaBookingReadiness()).toMatchObject({enabled:true,workspaceId});
  },30_000);

  it("issues, resends, verifies and consumes one Production OTP, then lets Maria confirm and mark Swish manually",async()=>{
    const ready=await getMariaBookingReadiness();
    expect(ready).toMatchObject({enabled:true,workspaceId});
    const issued=await beginBookingEmailVerification({
      workspaceId,slug:"makeup-by-maria",companyName:"Makeup by Maria",
      ownerEmail:"maria@example.invalid",customerName:"Synthetic Bride",
      customerEmail:"bride@example.invalid",customerPhone:"+46701234567",
      serviceId,serviceName:"Brudmakeup med prov",
      startsAt,endsAt,timeZone:"Europe/Stockholm",language:"ar",verificationSms:false,
    });
    expect(issued.ok).toBe(true);
    if(!issued.ok)throw Error("Initial Maria OTP was not issued");
    const id=issued.verificationId;
    const firstSent=JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as {subject:string;textContent:string;to:{email:string}[]};
    expect(firstSent.to[0]?.email).toBe("bride@example.invalid");
    expect(firstSent.subject).toContain("Makeup by Maria");
    const firstCode=firstSent.subject.match(/\b\d{6}\b/)?.[0];
    expect(firstCode).toMatch(/^\d{6}$/);

    // Customers may ask for a fresh code after a genuine 30-second cooldown.
    await db!.query("update public_booking_verifications set updated_at=now()-interval '45 seconds' where id=$1::uuid",[id]);
    const resent=await resendPublicBookingCode(id.toUpperCase(),"ar");
    expect(resent).toMatchObject({ok:true,delivery:"email"});
    const resendBody=JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)) as {subject:string;to:{email:string}[]};
    expect(resendBody.to[0]?.email).toBe("bride@example.invalid");
    let resentCode=resendBody.subject.match(/\b\d{6}\b/)?.[0];
    expect(resentCode).toMatch(/^\d{6}$/);
    // In the extremely rare case of a repeated random code, issue one more
    // synthetic resend so the replaced-code security assertion is deterministic.
    if (resentCode===firstCode) {
      await db!.query("update public_booking_verifications set updated_at=now()-interval '45 seconds' where id=$1::uuid",[id]);
      expect((await resendPublicBookingCode(id,"ar")).ok).toBe(true);
      const third=JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)) as {subject:string};
      resentCode=third.subject.match(/\b\d{6}\b/)?.[0];
    }
    expect(resentCode).not.toBe(firstCode);
    expect(await verifyPublicBookingCode(id,firstCode!,"ar")).toMatchObject({ok:false,error:"code"});
    expect((await db!.query("select id from bookings where workspace_id=$1 and source='public_booking'",[workspaceId])).rowCount).toBe(0);

    // Booking confirmation must still work when Brevo rejects its receipt.
    const successResponse = new Response(JSON.stringify({messageId:"synthetic-only"}),{status:201});
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      const payload = JSON.parse(String((options as RequestInit)?.body ?? "{}")) as {subject?: string};
      return payload.subject?.includes("تم استلام طلب حجزك")
        ? new Response("Synthetic email outage",{status:503}) : successResponse;
    });
    // Canonical UUID hashing must work with equivalent uppercase URL IDs.
    const verified=await verifyPublicBookingCode(id,resentCode!,"ar");
    expect(verified).toMatchObject({ok:true,slug:"makeup-by-maria"});
    expect(verified.ok && verified.portalUrl).toMatch(/^https:\/\/makeupbymaria\.se\/mina-bokningar\//);
    const bookings=await db!.query<{id:string;status:string}>(
      "select id::text,status from bookings where workspace_id=$1 and source='public_booking'",[workspaceId]);
    expect(bookings.rowCount).toBe(1);
    const bookingId=bookings.rows[0]!.id;
    expect(bookings.rows[0]!.status).toBe("requested");
    const beforeRetryEmailCount=vi.mocked(fetch).mock.calls.length;
    const again=await verifyPublicBookingCode(id.toUpperCase(),resentCode!,"ar");
    expect(again).toMatchObject({ok:true,slug:"makeup-by-maria"});
    expect(again.ok && again.portalUrl).toBe(verified.ok && verified.portalUrl);
    expect(vi.mocked(fetch).mock.calls.length).toBe(beforeRetryEmailCount);
    // A different code cannot recover the booking after consumption.
    expect(await verifyPublicBookingCode(id,resentCode==="000000"?"111111":"000000","ar"))
      .toMatchObject({ok:false,error:"code"});

    // Real PostgreSQL contention: with one remaining attempt, 11 parallel
    // requests (valid + invalid) must never issue more than one recovery.
    await db!.query(
      "update public_booking_verifications set attempts=max_attempts-1 where id=$1::uuid",
      [id],
    );
    const wrongCode=resentCode==="000000"?"111111":"000000";
    const guesses=[resentCode!,...Array.from({length:10},()=>wrongCode)];
    const outcomes=await withParallelSql(() =>
      Promise.all(guesses.map(value=>verifyPublicBookingCode(id,value,"ar"))));
    expect(outcomes.filter(outcome=>outcome.ok).length).toBeLessThanOrEqual(1);
    const attempts=(await db!.query<{attempts:number;max_attempts:number}>(
      "select attempts,max_attempts from public_booking_verifications where id=$1::uuid",[id],
    )).rows[0];
    expect(attempts?.attempts).toBe(attempts?.max_attempts);
    expect(await verifyPublicBookingCode(id,resentCode!,"ar"))
      .toMatchObject({ok:false,error:"invalid"});
    expect((await db!.query("select id from bookings where workspace_id=$1 and source='public_booking'",[workspaceId])).rowCount).toBe(1);
    const customerMessages=vi.mocked(fetch).mock.calls.map(([,options])=>JSON.parse(String(options?.body)) as {subject:string;htmlContent:string;to:{email:string}[]});
    // Assert a trusted portal origin, not a substring that could appear on an attacker host.
    const hasTrustedMariaPortalLink = (html: string) =>
      [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].some(([, href]) => {
        try {
          const url = new URL(href);
          return url.origin === "https://makeupbymaria.se"
            && url.pathname.startsWith("/mina-bokningar/");
        } catch {
          return false;
        }
      });
    expect(hasTrustedMariaPortalLink(
      '<a href="https://makeupbymaria.se.evil.example/mina-bokningar/fake">Fake</a>',
    )).toBe(false);
    expect(customerMessages.some(m=>m.subject.includes("تم استلام طلب حجزك")
      && hasTrustedMariaPortalLink(m.htmlContent))).toBe(true);

    const confirmed=await updateDashboardBookingStatus(bookingId,"confirmed");
    expect(confirmed.changed).toBe(true);
    expect(confirmed.notification?.customerEmail).toBe("bride@example.invalid");

    // Reactivation must also bring the *same* linked service job back from
    // cancelled, clearing its stale cancellation marker atomically.
    const linkedJobBefore = await db!.query<{id:string;status:string}>(
      "select id::text,status from workspace_service_jobs where booking_id=$1::uuid",[bookingId]);
    expect(linkedJobBefore.rowCount).toBe(1);
    const originalJobId=linkedJobBefore.rows[0]!.id;
    expect(["new","assigned"]).toContain(linkedJobBefore.rows[0]?.status);
    // Stopping new-booking intake must NOT strand an existing confirmed booking.
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED","false");
    expect(await getMariaBookingReadiness()).toEqual({enabled:false});
    // Removing existing-lifecycle email permission still fails closed.
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED","false");
    await expect(updateDashboardBookingStatus(bookingId,"cancelled"))
      .rejects.toThrow("Maria booking status changes are disabled in Production");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED","true");
    const cancelled=await updateDashboardBookingStatus(bookingId,"cancelled");
    expect(cancelled.changed).toBe(true);
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED","true");
    const cancelledJob=await db!.query<{status:string;cancelled_at:string|null}>(
      "select status,cancelled_at::text from workspace_service_jobs where id=$1::uuid",[originalJobId]);
    expect(cancelledJob.rows[0]?.status).toBe("cancelled");
    expect(cancelledJob.rows[0]?.cancelled_at).not.toBeNull();
    const reactivated=await updateDashboardBookingStatus(bookingId,"confirmed");
    expect(reactivated.changed).toBe(true);
    const revivedJob=await db!.query<{id:string;status:string;cancelled_at:string|null;completed_at:string|null}>(
      "select id::text,status,cancelled_at::text,completed_at::text from workspace_service_jobs where booking_id=$1::uuid",[bookingId]);
    expect(revivedJob.rowCount).toBe(1);
    expect(revivedJob.rows[0]?.id).toBe(originalJobId);
    expect(["new","assigned"]).toContain(revivedJob.rows[0]?.status);
    expect(revivedJob.rows[0]?.cancelled_at).toBeNull();
    expect(revivedJob.rows[0]?.completed_at).toBeNull();

    expect(await readMariaSwishQrEligibility(bookingId)).toBe("eligible");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED","false");
    expect(await readMariaSwishQrEligibility(bookingId)).toBe("unavailable");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED","true");
    expect(await setMariaManualSwishStatus(bookingId,"paid")).toEqual({changed:true});
    expect(await readMariaSwishQrEligibility(bookingId)).toBe("unavailable");
    const paid=await readMariaManualSwishStatuses();
    expect(paid.entries[bookingId]?.state).toBe("paid");

    const statusEmail=await sendMariaBookingStatusEmail({
      bookingId,workspaceId,status:"confirmed",customerName:"Synthetic Bride",
      customerEmail:"bride@example.invalid",companyName:"Makeup by Maria",
      service:"Brudmakeup med prov",startsAt,endsAt,city:"Södertälje",language:"ar",
      timeZone:"Europe/Stockholm",
    });
    expect(statusEmail).toEqual({ok:true});
    const last=JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)) as {htmlContent:string;textContent:string};
    expect(last.htmlContent).not.toContain("/api/makeup-by-maria/swish-qr/");
    expect(last.textContent).not.toContain("123-581 86 53");

    // One owner-controlled closed start on the same Friday must be visible
    // in the dedicated Maria manager calendar, without touching other tenants.
    const calendar=await changeMariaManualCalendar({date:day,mode:"close",clock:"15:00"});
    expect(calendar).toBeDefined();
    const closed=await db!.query(
      "select starts_at from maria_manual_closed_starts where workspace_id=$1::uuid",
      [workspaceId]);
    expect(closed.rowCount).toBeGreaterThan(0);
  },120_000);


  it("holds the workspace email lock until a concurrent manual Swish update can proceed", async () => {
    const booking = (await db!.query<{ id: string }>(
      "select id::text from bookings where workspace_id=$1 and status='confirmed' and source='public_booking' order by created_at desc limit 1",
      [workspaceId],
    )).rows[0];
    expect(booking?.id).toBeTruthy();
    await setMariaManualSwishStatus(booking!.id, "paid");

    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const pendingProvider = new Promise<void>(resolve => { release = resolve; });
    const first = withMariaBookingNotificationLock(workspaceId, async () => {
      entered();
      await pendingProvider;
      return "email-provider-accepted";
    });
    let completed = false;
    let update: Promise<{ changed: boolean }> | undefined;
    try {
      await Promise.race([started, delay(5_000).then(() => { throw new Error("Synthetic provider lock unavailable"); })]);
      update = setMariaManualSwishStatus(booking!.id, "unverified")
        .then(result => { completed = true; return result; });
      await delay(150);
      expect(completed).toBe(false);
      const state = await db!.query<{ state: string }>(
        "select metadata->>'state' as state from customer_events where booking_id=$1::uuid and metadata->>'source'='maria_swish_manual_deposit_v1' order by created_at desc,id desc limit 1",
        [booking!.id],
      );
      expect(state.rows[0]?.state).toBe("paid");
    } finally {
      release();
      await first.catch(() => undefined);
    }
    expect(await update).toMatchObject({ changed: true });
    await setMariaManualSwishStatus(booking!.id, "paid");
  }, 30_000);

  it("matches millisecond timestamps from real PostgreSQL but refuses altered start and end times", async () => {
    const row = (await db!.query<{ id: string; starts_at: Date; ends_at: Date; customer_email: string }>(
      `select b.id::text,b.starts_at,b.ends_at,c.email as customer_email
       from bookings b join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
       where b.workspace_id=$1 and b.status='confirmed' and b.source='public_booking'
       order by b.created_at desc limit 1`, [workspaceId],
    )).rows[0];
    expect(row?.id).toBeTruthy();
    const start = new Date(row!.starts_at).toISOString();
    const end = new Date(row!.ends_at).toISOString();
    try {
      await db!.query(
        "update bookings set starts_at=$2::timestamptz+interval '0.0004 seconds',ends_at=$3::timestamptz+interval '0.0004 seconds' where id=$1::uuid",
        [row!.id, start, end],
      );
      const input = {
        bookingId:row!.id, workspaceId,status:"confirmed" as const,
        customerName:"Synthetic Bride",customerEmail:row!.customer_email,
        companyName:"Makeup by Maria",service:"Brudmakeup med prov",
        startsAt:start,endsAt:end,city:"Södertälje",
        timeZone:"Europe/Stockholm" as const,
      };
      const provider = vi.mocked(fetch);
      provider.mockClear();
      expect(await sendMariaBookingStatusEmail(input)).toEqual({ ok: true });
      expect(provider).toHaveBeenCalledOnce();
      provider.mockClear();
      expect(await sendMariaBookingStatusEmail({
        ...input, startsAt:new Date(Date.parse(start)+60_000).toISOString(),
      })).toMatchObject({ ok: false, error:"invalid_booking" });
      expect(provider).not.toHaveBeenCalled();
      expect(await sendMariaBookingStatusEmail({
        ...input, endsAt:new Date(Date.parse(end)+60_000).toISOString(),
      })).toMatchObject({ ok: false, error:"invalid_booking" });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      await db!.query(
        "update bookings set starts_at=$2::timestamptz,ends_at=$3::timestamptz where id=$1::uuid",
        [row!.id,start,end],
      );
    }
  }, 30_000);

  it("delivers an authorized manager cancellation to a padded stored email through real PostgreSQL", async () => {
    const booking = (await db!.query<{
      id: string; customer_id: string; email: string; status: string;
      starts_at: Date; ends_at: Date;
    }>(`
      select b.id::text,c.id::text as customer_id,c.email,b.status,
        b.starts_at,b.ends_at
      from bookings b join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
      where b.workspace_id=$1 and b.source='public_booking'
      order by b.created_at desc limit 1
    `,[workspaceId])).rows[0];
    expect(booking?.status).toBe("confirmed");
    const padded = "\tBRIDE@example.invalid  \r";
    await db!.query(
      "update customers set email=$1 where id=$2::uuid and workspace_id=$3",
      [padded,booking!.customer_id,workspaceId],
    );
    let changed = false;
    try {
      // Existing bookings remain cancellable while new intake is paused.
      vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED","false");
      const result = await updateDashboardBookingStatus(booking!.id,"cancelled");
      expect(result.changed).toBe(true);
      changed = true;
      expect(await sendMariaBookingStatusEmail({
        bookingId: booking!.id,workspaceId,status:"cancelled",
        customerName:"Synthetic Bride",customerEmail:padded,
        companyName:"Makeup by Maria",service:"Brudmakeup med prov",
        startsAt:new Date(booking!.starts_at).toISOString(),
        endsAt:new Date(booking!.ends_at).toISOString(),
        city:"Södertälje",timeZone:"Europe/Stockholm",
      })).toEqual({ok:true});
      const sent = JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)) as {
        to: Array<{email:string}>; textContent: string;
      };
      expect(sent.to[0]?.email).toBe("bride@example.invalid");
      expect(sent.textContent).not.toContain("Pay within 24 hours");
    } finally {
      vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED","true");
      await db!.query(
        "update customers set email=$1 where id=$2::uuid and workspace_id=$3",
        [booking!.email,booking!.customer_id,workspaceId],
      );
      if (changed) expect((await updateDashboardBookingStatus(booking!.id,"confirmed")).changed).toBe(true);
    }
  },30_000);

  // Independent booking prevents earlier test notices from contaminating
  // the retry gate (a pending notice must correctly remain blocking).
  async function makeIsolatedRetryBooking() {
    const customerId=randomUUID(),bookingId=randomUUID();
    const start=new Date(Date.parse(startsAt)+63*86_400_000).toISOString();
    const end=new Date(Date.parse(endsAt)+63*86_400_000).toISOString();
    const service=(await db!.query<{name:string}>(
      "select name from workspace_services where id=$1::uuid and workspace_id=$2",
      [serviceId,workspaceId],
    )).rows[0]!.name;
    await db!.query(
      "insert into customers(id,workspace_id,name,email,status,source) values($1::uuid,$2,'Isolated retry QA','retry-qa@example.invalid','active','dashboard_manual')",
      [customerId,workspaceId],
    );
    await db!.query(
      "insert into bookings(id,workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at) values($1::uuid,$2,$3::uuid,$4::uuid,'Synthetic retry booking',$5,'confirmed','dashboard_manual',$6::timestamptz,$7::timestamptz)",
      [bookingId,workspaceId,customerId,serviceId,service,start,end],
    );
    const row=(await db!.query<{id:string;customer_id:string;updated_at:Date}>(
      "select id::text,customer_id::text,updated_at from bookings where id=$1::uuid",[bookingId],
    )).rows[0]!;
    return {...row,cleanup:async()=>{
      await db!.query("delete from customer_events where booking_id=$1::uuid",[bookingId]);
      await db!.query("delete from bookings where id=$1::uuid",[bookingId]);
      await db!.query("delete from customers where id=$1::uuid",[customerId]);
    }};
  }

  it("queries the real retry gate and journals older revisions without overwriting a newer notice", async () => {
    const b=await makeIsolatedRetryBooking();
    const revision = new Date(b!.updated_at).toISOString();
    const originalId = (await db!.query<{id:string}>(
      `insert into customer_events (workspace_id,customer_id,booking_id,event_type,title,metadata)
       values ($1,$2::uuid,$3::uuid,'status_change','Synthetic old failed email',$4::jsonb)
       returning id::text`,
      [workspaceId,b!.customer_id,b!.id,JSON.stringify({
        source:"dashboard_manual",new_status:"confirmed",
        notice_revision:revision,notice_customer:"failed",
      })],
    )).rows[0]!.id;
    try {
      expect(await getMariaStatusRetryGate({
        workspaceId,bookingId:b!.id,status:"confirmed",revision,
      })).toBe("retryable");

      expect(await recordMariaStatusRetryAudit({
        workspaceId,bookingId:b!.id,status:"confirmed",revision,
        outcome:"accepted",parentEventId:originalId,
      })).toBe(true);
      expect(await getMariaStatusRetryGate({
        workspaceId,bookingId:b!.id,status:"confirmed",revision,
      })).toBe("accepted");

      // An older failure must remain an immutable audit fact. A later
      // unsuccessful attempt cannot override the accepted same-revision gate.
      expect(await recordMariaStatusRetryAudit({
        workspaceId,bookingId:b!.id,status:"confirmed",revision,
        outcome:"failed",parentEventId:originalId,
      })).toBe(true);
      expect(await getMariaStatusRetryGate({
        workspaceId,bookingId:b!.id,status:"confirmed",revision,
      })).toBe("accepted");
      const original = (await db!.query<{state:string}>(
        "select metadata->>'notice_customer' as state from customer_events where id=$1::uuid",
        [originalId],
      )).rows[0];
      expect(original?.state).toBe("failed");

      await db!.query("update bookings set updated_at=updated_at+interval '1 second' where id=$1::uuid", [b!.id]);
      expect(await getMariaStatusRetryGate({
        workspaceId,bookingId:b!.id,status:"confirmed",revision,
      })).toBe("revision_changed");
      expect(await recordMariaStatusRetryAudit({
        workspaceId,bookingId:b!.id,status:"confirmed",revision,
        outcome:"uncertain",parentEventId:originalId,
      })).toBe(true);
      const history = await db!.query<{state:string;current:boolean;revision:string}>(
        `select metadata->>'notice_customer' as state,
          (metadata->>'is_current_revision')::boolean as current,
          metadata->>'notice_revision' as revision
         from customer_events
         where workspace_id=$1 and booking_id=$2::uuid
           and metadata->>'source'='maria_status_retry'
         order by created_at desc,id desc limit 1`,
        [workspaceId,b!.id],
      );
      expect(history.rows[0]).toMatchObject({state:"uncertain",current:false,revision});
    } finally {
      await db!.query("update bookings set updated_at=$2::timestamptz where id=$1::uuid", [b!.id,revision]);
      await db!.query(
        "delete from customer_events where workspace_id=$1 and booking_id=$2::uuid and (id=$3::uuid or metadata->>'source'='maria_status_retry')",
        [workspaceId,b!.id,originalId],
      );
      await b.cleanup();
    }
  },30_000);

  it("keeps uncertain, pending and sending notices blocked despite a later failed event in PostgreSQL", async () => {
    const b=await makeIsolatedRetryBooking();
    const revision=new Date(b.updated_at).toISOString(), ids:string[]=[];
    const add=async (state:string)=>{
      const result=await db!.query<{id:string}>(
        "insert into customer_events(workspace_id,customer_id,booking_id,event_type,title,metadata) values($1,$2::uuid,$3::uuid,'status_change','Synthetic gate',$4::jsonb) returning id::text",
        [workspaceId,b.customer_id,b.id,JSON.stringify({
          source:"dashboard_manual",new_status:"confirmed",notice_revision:revision,notice_customer:state,
        })]);
      const eventId=result.rows[0]!.id;ids.push(eventId);return eventId;
    };
    const input={workspaceId,bookingId:b.id,status:"confirmed" as const,revision,parentEventId:null};
    try {
      const first=await add("uncertain");
      await add("failed");
      expect(await getMariaStatusRetryGate(input)).toBe("uncertain");
      expect(await claimMariaStatusRetry(input)).toBeNull();
      // A current-revision PENDING notice must also block the read gate and
      // the atomic claim, even when a later separate attempt is failed.
      await db!.query("update customer_events set metadata=jsonb_set(metadata,'{notice_customer}',to_jsonb('pending'::text)) where id=$1::uuid",[first]);
      expect(await getMariaStatusRetryGate(input)).toBe("uncertain");
      expect(await claimMariaStatusRetry(input)).toBeNull();
      await db!.query("update customer_events set metadata=jsonb_set(metadata,'{notice_customer}',to_jsonb('sending'::text)) where id=$1::uuid",[first]);
      expect(await getMariaStatusRetryGate(input)).toBe("uncertain");
      expect(await claimMariaStatusRetry(input)).toBeNull();
    } finally {
      await db!.query("delete from customer_events where id=any($1::uuid[])",[ids]);
      await b.cleanup();
    }
  },30_000);

  it("atomically claims one exact revision across competing PostgreSQL senders", async () => {
    const b=await makeIsolatedRetryBooking();
    const revision=new Date(b.updated_at).toISOString();
    const origin=(await db!.query<{id:string}>(
      "insert into customer_events(workspace_id,customer_id,booking_id,event_type,title,metadata) values($1,$2::uuid,$3::uuid,'status_change','Synthetic failed',$4::jsonb) returning id::text",
      [workspaceId,b.customer_id,b.id,JSON.stringify({
        source:"dashboard_manual",new_status:"confirmed",notice_revision:revision,notice_customer:"failed",
      })])).rows[0]!.id;
    let claimId:string|null=null;
    const input={workspaceId,bookingId:b.id,status:"confirmed" as const,revision,parentEventId:origin};
    try {
      const claimed=await Promise.all([claimMariaStatusRetry(input),claimMariaStatusRetry(input)]);
      expect(claimed.filter(Boolean)).toHaveLength(1);
      claimId=claimed.find(Boolean)??null;
      expect(claimId).toBeTruthy();
      expect(await getMariaStatusRetryGate(input)).toBe("uncertain");
      expect(await finishMariaStatusRetry({
        workspaceId,bookingId:b.id,status:"confirmed",revision,claimId:claimId!,outcome:"accepted",
      })).toBe(true);
      expect(await finishMariaStatusRetry({
        workspaceId,bookingId:b.id,status:"confirmed",revision,claimId:claimId!,outcome:"failed",
      })).toBe(false);
      expect(await getMariaStatusRetryGate(input)).toBe("accepted");
      expect(await claimMariaStatusRetry(input)).toBeNull();
      expect((await db!.query<{state:string}>(
        "select metadata->>'notice_customer' as state from customer_events where id=$1::uuid",[origin]
      )).rows[0]?.state).toBe("failed");
    } finally {
      await db!.query("delete from customer_events where id=any($1::uuid[])",[[origin,...(claimId?[claimId]:[])]]);
      await b.cleanup();
    }
  },30_000);

  it("blocks duplicate cancellation emails after portal accepted or legacy unversioned notices", async () => {
    const b=await makeIsolatedRetryBooking();
    const originalRevision=new Date(b.updated_at).toISOString();
    const changed=await db!.query<{updated_at:Date}>(
      "update bookings set status='cancelled',updated_at=now() where id=$1::uuid returning updated_at",[b.id]);
    const revision=new Date(changed.rows[0]!.updated_at).toISOString();
    const event=(await db!.query<{id:string}>(
      "insert into customer_events(workspace_id,customer_id,booking_id,event_type,title,metadata) values($1,$2::uuid,$3::uuid,'status_change','Synthetic portal',$4::jsonb) returning id::text",
      [workspaceId,b.customer_id,b.id,JSON.stringify({
        source:"customer_portal",new_status:"cancelled",notice_revision:revision,notice_customer:"accepted",
      })])).rows[0]!.id;
    const input={workspaceId,bookingId:b.id,status:"cancelled" as const,revision,parentEventId:event};
    try {
      expect(await getMariaStatusRetryGate(input)).toBe("accepted");
      expect(await claimMariaStatusRetry(input)).toBeNull();
      await db!.query("update customer_events set metadata=jsonb_set(metadata,'{notice_customer}',to_jsonb('uncertain'::text)) where id=$1::uuid",[event]);
      expect(await getMariaStatusRetryGate(input)).toBe("uncertain");
      expect(await claimMariaStatusRetry(input)).toBeNull();
      await db!.query("update customer_events set metadata=(metadata-'notice_revision')||jsonb_build_object('notice_customer','failed') where id=$1::uuid",[event]);
      expect(await getMariaStatusRetryGate(input)).toBe("uncertain");
      expect(await claimMariaStatusRetry(input)).toBeNull();
    } finally {
      await db!.query("delete from customer_events where id=$1::uuid",[event]);
      await db!.query("update bookings set status='confirmed',updated_at=$2::timestamptz where id=$1::uuid",[b.id,originalRevision]);
      await b.cleanup();
    }
  },30_000);

  it("normalizes tabs in Preview email using PostgreSQL's actual btrim predicate", async () => {
    const result = await db!.query<{ matches: boolean; mismatch: boolean }>(
      `select
        lower(btrim($1::text, chr(9) || chr(10) || chr(13) || ' ')) = lower($2::text) as matches,
        lower(btrim($3::text, chr(9) || chr(10) || chr(13) || ' ')) = lower($2::text) as mismatch`,
      ["\tQA@example.invalid  \r", "qa@example.invalid", "different@example.invalid"],
    );
    expect(result.rows[0]).toMatchObject({ matches: true, mismatch: false });
  });

  it("keeps two real PostgreSQL bookings with the same old six-digit prefix independently payable", async () => {
    const ids = [
      "abcdef00-1111-4111-8111-111111111111",
      "abcdef99-2222-4222-8222-222222222222",
    ];
    const customerId = randomUUID();
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    // Canonical policy resolves the service by exact stored name.
    const service = await db!.query<{ name: string }>(
      "select name from workspace_services where id=$1::uuid and workspace_id=$2",
      [serviceId, workspaceId],
    );
    const serviceName = service.rows[0]?.name;
    expect(serviceName).toBeTruthy();
    await db!.query(
      "insert into customers(id,workspace_id,name,email,status,source) values($1::uuid,$2,'Synthetic collision customer','collision@example.invalid','active','dashboard_manual')",
      [customerId, workspaceId],
    );
    try {
      for (let index = 0; index < ids.length; index++) {
        const offset = (index + 2) * 7 * 86_400_000;
        await db!.query(
          `insert into bookings(id,workspace_id,customer_id,service_id,title,service,status,source,starts_at,ends_at)
           values($1::uuid,$2,$3::uuid,$4::uuid,'Synthetic payment reference collision',
             $5::text,'confirmed','public_booking',$6::timestamptz,$7::timestamptz)`,
          [ids[index], workspaceId, customerId, serviceId, serviceName,
            new Date(start + offset).toISOString(), new Date(end + offset).toISOString()],
        );
      }
      expect(mariaBookingNumber(ids[0]!).slice(0, 10)).toBe(mariaBookingNumber(ids[1]!).slice(0, 10));
      expect(mariaBookingNumber(ids[0]!)).not.toBe(mariaBookingNumber(ids[1]!));
      expect(await readMariaSwishQrEligibility(ids[0]!)).toBe("eligible");
      expect(await readMariaSwishQrEligibility(ids[1]!)).toBe("eligible");
    } finally {
      await db!.query("delete from bookings where id=any($1::uuid[])", [ids]);
      await db!.query("delete from customers where id=$1::uuid", [customerId]);
    }
  },30_000);
  it("serializes Maria retry claims and lease recovery on real concurrent PostgreSQL connections", async () => {
    const booking = (await db!.query<{
      id: string; customer_id: string; starts_at: string; ends_at: string;
    }>("select id::text,customer_id::text,starts_at::text,ends_at::text from bookings where workspace_id=$1 and source='public_booking' order by created_at desc limit 1",[workspaceId])).rows[0];
    expect(booking?.id).toBeTruthy();
    const eventId = (await db!.query<{id:string}>(
      `insert into customer_events(workspace_id,customer_id,booking_id,event_type,title,description,metadata)
       values($1,$2::uuid,$3::uuid,'booking','Synthetic retry','Synthetic only',$4::jsonb) returning id::text`,
      [workspaceId,booking!.customer_id,booking!.id,JSON.stringify({
        source:"maria_preview_reschedule",
        previous_starts_at:new Date(new Date(booking!.starts_at).getTime()-604800000).toISOString(),
        previous_ends_at:new Date(new Date(booking!.ends_at).getTime()-604800000).toISOString(),
        starts_at:new Date(booking!.starts_at).toISOString(),
        ends_at:new Date(booking!.ends_at).toISOString(),
        language:"en",notice_customer:"failed",notice_owner:"sent",
        notice_attempted_at:"2026-01-01T00:00:00Z",
      })],
    )).rows[0]!.id;
    const sender=vi.mocked(sendBookingChangeEmails);
    const successful=[
      {status:"fulfilled" as const,value:{ok:true as const}},
      {status:"fulfilled" as const,value:{ok:true as const}},
    ] as Awaited<ReturnType<typeof sendBookingChangeEmails>>;
    const setState=async (customer:string,attempted:string)=>db!.query(
      `update customer_events set metadata=metadata||jsonb_build_object(
        'notice_customer',$2::text,'notice_owner','sent','notice_attempted_at',$3::text)
       where id=$1::uuid`,[eventId,customer,attempted],
    );
    try {
      await withParallelSql(async()=>{
        sender.mockReset().mockImplementation(async()=>{await delay(90);return successful;});
        const results=await Promise.all([
          retryMariaRescheduleNotice(booking!.id,workspaceId),
          retryMariaRescheduleNotice(booking!.id,workspaceId),
        ]);
        expect(results.filter(result=>result.ok)).toHaveLength(1);
        expect(sender).toHaveBeenCalledOnce();
        const sent=(await db!.query<{state:string}>(
          "select metadata->>'notice_customer' as state from customer_events where id=$1::uuid",
          [eventId],
        )).rows[0];
        expect(sent?.state).toBe("sent");
        // An already delivered notice is idempotent and never triggers another send.
        expect(await retryMariaRescheduleNotice(booking!.id,workspaceId))
          .toEqual({ok:false,alreadySent:true});
        expect(sender).toHaveBeenCalledOnce();

        // Even an EXPIRED 'sending' lease may mean Brevo accepted the mail.
        // Time alone cannot authorize a duplicate delivery.
        await setState("sending",new Date().toISOString());
        sender.mockClear();
        expect(await retryMariaRescheduleNotice(booking!.id,workspaceId)).toEqual({ok:false});
        await setState("sending","2026-01-01T00:00:00Z");
        expect(await retryMariaRescheduleNotice(booking!.id,workspaceId)).toEqual({ok:false});
        await setState("uncertain","2026-01-01T00:00:00Z");
        expect(await retryMariaRescheduleNotice(booking!.id,workspaceId)).toEqual({ok:false});
        expect(sender).not.toHaveBeenCalled();
        // Only after external evidence proves non-delivery may an authorized
        // administrator reconcile the state to 'failed' for a controlled retry.
        await setState("failed","2026-01-01T00:00:00Z");
        expect(await retryMariaRescheduleNotice(booking!.id,workspaceId)).toEqual({ok:true});
        expect(sender).toHaveBeenCalledOnce();

        // A stale sender must not overwrite a newer claim's result.
        await setState("failed","2026-01-01T00:00:00Z");
        sender.mockReset();
        let signalStarted!:()=>void,release!:()=>void;
        const started=new Promise<void>(resolve=>{signalStarted=resolve;});
        const hold=new Promise<void>(resolve=>{release=resolve;});
        sender.mockImplementationOnce(async()=>{signalStarted();await hold;return successful;});
        const pending=retryMariaRescheduleNotice(booking!.id,workspaceId);
        await started;
        await setState("sending","2099-01-01T00:00:00Z");
        release();
        expect(await pending).toEqual({ok:false});
        expect((await db!.query<{state:string;attempt:string}>(
          "select metadata->>'notice_customer' as state,metadata->>'notice_attempted_at' as attempt from customer_events where id=$1::uuid",
          [eventId],
        )).rows[0]).toMatchObject({state:"sending",attempt:"2099-01-01T00:00:00Z"});

        // The latest event cannot be retried once its booking time is obsolete.
        await setState("failed","2026-01-01T00:00:00Z");
        await db!.query(
          `update customer_events set metadata=jsonb_set(metadata,'{starts_at}',to_jsonb('2099-01-01T00:00:00Z'::text)) where id=$1::uuid`,
          [eventId],
        );
        sender.mockClear();
        expect(await retryMariaRescheduleNotice(booking!.id,workspaceId)).toEqual({ok:false});
        expect(sender).not.toHaveBeenCalled();
      });
    } finally {
      sender.mockReset();
      await db!.query("delete from customer_events where id=$1::uuid",[eventId]);
    }
  },60_000);

});
