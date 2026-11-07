import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

type Query = { text: string; values: unknown[] };
const runtime = vi.hoisted(() => ({
  makeSql: undefined as undefined | (() => unknown),
  workspaceId: "",
  userId: "synthetic-maria-manager",
}));
vi.mock("server-only", () => ({}));
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
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("TEST_REDIRECT:" + url); } }));
vi.mock("@/features/sms/booking-sms", () => ({
  sendBookingVerificationSms: () => { throw new Error("Maria must never send verification SMS"); },
  sendBookingOwnerSms: () => { throw new Error("Maria must never send owner SMS"); },
}));

import { beginBookingEmailVerification, resendPublicBookingCode, verifyPublicBookingCode } from "@/lib/public-booking-verification";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { updateDashboardBookingStatus } from "@/lib/dashboard-booking-status";
import { setMariaManualSwishStatus, readMariaManualSwishStatuses } from "@/lib/maria-manual-swish";
import { changeMariaManualCalendar } from "@/lib/maria-manual-calendar";
import { sendMariaBookingStatusEmail } from "@/features/email/maria-deposit-email";

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

  beforeEach(()=>{
    const flags:Record<string,string>={
      VERCEL_ENV:"production",PROFFERA_MARIA_PUBLIC_SITE_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED:"true",
      PROFFERA_MARIA_PRODUCTION_ORIGIN:"https://makeupbymaria.se",
      BREVO_API_KEY:"synthetic-production-email-key",
      LEAD_FROM_EMAIL:"Makeup by Maria <noreply@example.invalid>",
      BETTER_AUTH_SECRET:"synthetic-only-for-isolated-postgres-test",
    };
    for(const [key,value] of Object.entries(flags))vi.stubEnv(key,value);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(
      new Response(JSON.stringify({messageId:"synthetic-only"}),{status:201})));
  });
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

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
    const resent=await resendPublicBookingCode(id,"ar");
    expect(resent).toMatchObject({ok:true,delivery:"email"});
    const resendBody=JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)) as {subject:string;to:{email:string}[]};
    expect(resendBody.to[0]?.email).toBe("bride@example.invalid");
    const resentCode=resendBody.subject.match(/\b\d{6}\b/)?.[0];
    expect(resentCode).toMatch(/^\d{6}$/);

    const verified=await verifyPublicBookingCode(id,resentCode!,"ar");
    expect(verified).toMatchObject({ok:true,slug:"makeup-by-maria"});
    const bookings=await db!.query<{id:string;status:string}>(
      "select id::text,status from bookings where workspace_id=$1 and source='public_booking'",[workspaceId]);
    expect(bookings.rowCount).toBe(1);
    const bookingId=bookings.rows[0]!.id;
    expect(bookings.rows[0]!.status).toBe("requested");
    const again=await verifyPublicBookingCode(id,resentCode!,"ar");
    expect(again).toMatchObject({ok:false,error:"invalid"});
    expect((await db!.query("select id from bookings where workspace_id=$1 and source='public_booking'",[workspaceId])).rowCount).toBe(1);
    const customerMessages=vi.mocked(fetch).mock.calls.map(([,options])=>JSON.parse(String(options?.body)) as {subject:string;htmlContent:string;to:{email:string}[]});
    expect(customerMessages.some(m=>m.subject.includes("تم استلام طلب حجزك")
      && m.htmlContent.includes("https://makeupbymaria.se/mina-bokningar/"))).toBe(true);

    const confirmed=await updateDashboardBookingStatus(bookingId,"confirmed");
    expect(confirmed.changed).toBe(true);
    expect(confirmed.notification?.customerEmail).toBe("bride@example.invalid");
    expect(await setMariaManualSwishStatus(bookingId,"paid")).toEqual({changed:true});
    const paid=await readMariaManualSwishStatuses();
    expect(paid.entries[bookingId]?.state).toBe("paid");

    const statusEmail=await sendMariaBookingStatusEmail({
      bookingId,status:"confirmed",customerName:"Synthetic Bride",
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
});
