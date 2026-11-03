import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

type Query = { text: string; values: unknown[] };
type Rows = Record<string, unknown>[];

const access = vi.hoisted(() => ({
  workspaceId: "", role: "owner", slug: "makeup-by-maria", entitled: true,
  makeSql: undefined as undefined | (() => unknown),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: () => access.makeSql?.() ?? null }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceId: access.workspaceId, workspaceSlug: access.slug,
    role: access.role, userId: "maria-calendar-qa",
  }),
  canManageWorkspaceSettings: (user: { role: string }) =>
    user.role === "owner" || user.role === "admin",
}));
vi.mock("@/lib/workspace-module-access", () => ({
  hasDashboardModuleAccess: async (name: string) => name === "online_booking" && access.entitled,
}));
vi.mock("@/lib/maria-preview-booking", () => ({
  getMariaPreviewBookingReadiness: async () => ({
    enabled: true, workspaceId: access.workspaceId, publicSlug: "makeup-by-maria",
  }),
}));

import {
  changeMariaManualCalendar, MariaCalendarError, readMariaManualCalendar,
} from "@/lib/maria-manual-calendar";
import { mariaCalendarIntervals } from "@/lib/maria-manual-calendar-policy";
import { getMariaAvailability } from "@/lib/maria-booking-availability";
import { finalizeMariaVerifiedBooking } from "@/lib/maria-verified-booking";

const RUN = process.env.GITHUB_ACTIONS === "true" || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) { return execFileSync("docker",args,{encoding:"utf8"}).trim(); }
function compileSql(parts: TemplateStringsArray, values: unknown[]): Query {
  let text = parts[0] ?? "";
  for (let i=0;i<values.length;i++) text += "$" + (i+1) + (parts[i+1] ?? "");
  return {text,values};
}
function futureFriday() {
  const tomorrow = new Date(Date.now() + 8 * 86_400_000);
  for(let i=0;i<7;i++){
    const trial = new Date(Date.UTC(tomorrow.getUTCFullYear(),tomorrow.getUTCMonth(),tomorrow.getUTCDate()+i));
    if(trial.getUTCDay()===5) return trial.toISOString().slice(0,10);
  }
  throw new Error("Synthetic future Friday not found");
}

(RUN ? describe.sequential : describe.skip)("Maria manual calendar isolated PostgreSQL integration",()=>{
  let container = "", connectionString = "";
  let db: Client | undefined;
  const workspaceId = randomUUID();
  const bookingId = randomUUID();
  const customerId = randomUUID();
  const day = futureFriday();
  const intervals = mariaCalendarIntervals(day,"06:00","10:00")!;
  const bookingStart = intervals[2]!.startsAt;
  const bookingEnd = new Date(Date.parse(bookingStart)+180*60_000).toISOString();

  beforeAll(async()=>{
    access.workspaceId=workspaceId;
    container="proffera-maria-calendar-"+process.pid+"-"+Date.now();
    docker(["run","--rm","-d","--name",container,
      "-e","POSTGRES_PASSWORD=postgres","-e","POSTGRES_USER=postgres",
      "-e","POSTGRES_DB=proffera_test","-p","127.0.0.1::5432","postgis/postgis:16-3.5-alpine"]);
    const port=docker(["port",container,"5432/tcp"]).split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if(!port)throw new Error("Maria calendar PostgreSQL port not available");
    connectionString="postgres://postgres:postgres@127.0.0.1:"+port+"/proffera_test";
    let ready=false;
    for(let i=0;i<80;i++){
      const probe=new Client({connectionString});
      try{await probe.connect();await probe.query("select 1");await probe.end();ready=true;break;}
      catch{await probe.end().catch(()=>undefined);await delay(500);}
    }
    if(!ready)throw new Error("PostgreSQL did not become ready");
    db=new Client({connectionString});
    await db.connect();
    await applyCanonicalProfferaMigrations(db);

    access.makeSql=()=>Object.assign(
      (parts:TemplateStringsArray,...values:unknown[])=>{
        const query=compileSql(parts,values);
        return Object.assign(query,{
          then:(resolve:(rows:Rows)=>unknown,reject:(error:unknown)=>unknown)=>
            db!.query(query.text,query.values).then(result=>resolve(result.rows as Rows),reject),
        });
      },
      {transaction:async(queries:Query[])=>{
        const tx=new Client({connectionString});
        await tx.connect();
        try{
          await tx.query("BEGIN");
          const results:Rows[]=[];
          for(const query of queries)results.push((await tx.query(query.text,query.values)).rows as Rows);
          await tx.query("COMMIT");
          return results;
        }catch(error){await tx.query("ROLLBACK").catch(()=>undefined);throw error;}
        finally{await tx.end();}
      }},
    );
    await db.query(
      "insert into workspaces(id,slug,name,status,public_booking_slug) values($1::uuid,'makeup-by-maria','Maria synthetic QA','active','makeup-by-maria')",
      [workspaceId],
    );
    await db.query(
      "insert into customers(id,workspace_id,name,email,status,source) values($1::uuid,$2,'Synthetic bride','qa@example.invalid','active','dashboard_manual')",
      [customerId,workspaceId],
    );
    // The canonical public_booking trigger requires an existing service by name.
    await db.query(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,is_active,public_status) values($1,'Brudmakeup','synthetic-calendar-fixture',180,true,'published')",
      [workspaceId],
    );
    await db.query(
      "insert into bookings(id,workspace_id,customer_id,title,service,status,source,starts_at,ends_at) values($1::uuid,$2,$3::uuid,'Synthetic booking','Brudmakeup','requested','public_booking',$4::timestamptz,$5::timestamptz)",
      [bookingId,workspaceId,customerId,bookingStart,bookingEnd],
    );
    await db.query(
      "insert into workspace_booking_hours(workspace_id,weekday,opens_at,closes_at,is_closed) values($1,5,'06:00','10:00',false)",
      [workspaceId],
    );
  },180_000);

  beforeEach(async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL","qa@example.invalid");
    access.workspaceId=workspaceId;access.slug="makeup-by-maria";access.role="owner";access.entitled=true;
    await db!.query("delete from maria_manual_closed_starts where workspace_id=$1::uuid",[workspaceId]);
    // Every test starts with only its one canonical synthetic customer booking.
    await db!.query("delete from bookings where workspace_id=$1 and id<>$2::uuid",[workspaceId,bookingId]);
    await db!.query("delete from public_booking_verifications where workspace_id=$1::uuid",[workspaceId]);
    await db!.query("update workspace_booking_hours set opens_at='06:00',closes_at='10:00',is_closed=false where workspace_id=$1 and weekday=5",[workspaceId]);
    await db!.query("update bookings set status='requested',starts_at=$1::timestamptz,ends_at=$2::timestamptz where id=$3::uuid",[bookingStart,bookingEnd,bookingId]);
  });
  afterEach(()=>vi.unstubAllEnvs());
  afterAll(async()=>{
    access.makeSql=undefined;
    await db?.end().catch(()=>undefined);
    if(container){try{docker(["stop",container]);}catch{/* already stopped */}}
  },30_000);

  async function manualBlocks(){
    const result=await db!.query<{starts_at:string}>(
      "select starts_at::text from maria_manual_closed_starts where workspace_id=$1::uuid order by starts_at",
      [workspaceId],
    );
    return result.rows;
  }
  async function persistedBooking(){
    const result=await db!.query(
      "select status,starts_at::text,ends_at::text from bookings where id=$1::uuid",[bookingId],
    );
    return result.rows[0];
  }
  it("shows requests separately and closes only the chosen booking start without modifying bookings",async()=>{
    const before=await persistedBooking();
    const original=await readMariaManualCalendar(day);
    expect(original.appointments.map(x=>x.id)).toContain(bookingId);
    expect(original.slots.find(x=>x.clock==="07:00")?.appointmentCount).toBe(1);
    expect(original.slots.find(x=>x.clock==="07:00")?.manuallyClosed).toBe(false);

    expect(await changeMariaManualCalendar({date:day,mode:"close",clock:"07:00"}))
      .toMatchObject({changed:true,affectedIntervals:1});
    expect(await persistedBooking()).toEqual(before);
    expect((await readMariaManualCalendar(day)).slots.find(x=>x.clock==="07:00")?.manuallyClosed).toBe(true);
    expect(await changeMariaManualCalendar({date:day,mode:"close",clock:"07:00"}))
      .toMatchObject({changed:false,affectedIntervals:0});
    expect(await manualBlocks()).toHaveLength(1);
  });

  it("opens only Maria calendar blocks, preserving the booked appointment and other managers' blocks",async()=>{
    const before=await persistedBooking();
    await changeMariaManualCalendar({date:day,mode:"close_day"});
    expect(await manualBlocks()).toHaveLength(9);
    await db!.query(
      "insert into bookings(workspace_id,customer_id,title,service,status,source,notes,starts_at,ends_at) values($1,null,'Generic block','Blockerad tid','confirmed','dashboard_availability_block','generic',$2::timestamptz,$3::timestamptz)",
      [workspaceId,intervals[1]!.startsAt,intervals[1]!.endsAt],
    );
    const partial=await changeMariaManualCalendar({date:day,mode:"open",clock:"07:00"});
    expect(partial.changed).toBe(true);
    expect(await manualBlocks()).toHaveLength(8);
    const all=await changeMariaManualCalendar({date:day,mode:"open_day"});
    expect(all.affectedIntervals).toBe(8);
    expect(await manualBlocks()).toHaveLength(0);
    const generic=await db!.query("select count(*)::int as count from bookings where workspace_id=$1 and notes='generic'",[workspaceId]);
    expect(generic.rows[0]?.count).toBe(1);
    expect(await persistedBooking()).toEqual(before);
    expect(await changeMariaManualCalendar({date:day,mode:"open_day"}))
      .toMatchObject({changed:false,affectedIntervals:0});
  });

  it("lets Maria open one chosen start after closing the day while other starts stay closed", async()=>{
    // Synthetic QA only: all data is created in the temporary PostgreSQL container.
    const year=Number(day.slice(0,4));
    await db!.query(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,is_active,public_status) values($1,'Synthetic independently managed start',$2,180,true,'published')",
      [workspaceId,`maria-bridal-without-trial-${year}`],
    );
    // Cancel the preloaded synthetic appointment to isolate manual-start behavior.
    await db!.query("update bookings set status='cancelled' where id=$1::uuid",[bookingId]);
    const availability=()=>getMariaAvailability({
      workspaceId,date:day,year,kind:"without",timeZone:"Europe/Stockholm",
    });
    const before=await availability();
    expect(before.ok).toBe(true);
    if(!before.ok) throw new Error("Synthetic Maria availability failed");
    expect(before.slots).toContain("06:00");
    expect(before.slots).toContain("07:00");

    await changeMariaManualCalendar({date:day,mode:"close",clock:"07:00"});
    const afterSingle=await availability();
    expect(afterSingle.ok).toBe(true);
    if(!afterSingle.ok) throw new Error("Synthetic close availability failed");
    expect(afterSingle.slots).toContain("06:00");
    expect(afterSingle.slots).not.toContain("07:00");
    expect(afterSingle.slots).toContain("07:30");

    await changeMariaManualCalendar({date:day,mode:"close_day"});
    const afterWholeDay=await availability();
    expect(afterWholeDay).toEqual({ok:true,slots:[]});

    await changeMariaManualCalendar({date:day,mode:"open",clock:"07:00"});
    const afterReopen=await availability();
    expect(afterReopen).toEqual({ok:true,slots:["07:00"]});
    expect(await manualBlocks()).toHaveLength(intervals.length-1);

    // Exercise Maria's ACTUAL finalizer under canonical PostgreSQL triggers
    // and the bookings_active_time_no_overlap exclusion constraint.
    // Neighboring manual closed starts must not prevent the accepted 07:00 booking.
    const confirmedStart=intervals.find(slot=>slot.clock==="07:00")!.startsAt;
    const confirmedEnd=new Date(Date.parse(confirmedStart)+180*60_000).toISOString();
    const service=await db!.query<{id:string}>(
      "select id::text from workspace_services where workspace_id=$1 and name='Synthetic independently managed start'",
      [workspaceId],
    );
    const hold=await db!.query<{id:string}>(
      "insert into public_booking_verifications(workspace_id,public_booking_slug,customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at) values($1::uuid,'makeup-by-maria','Synthetic bride','qa@example.invalid',$2::uuid,'Synthetic independently managed start',$3::timestamptz,$4::timestamptz,'synthetic-hash',now()+interval '15 minutes') returning id::text",
      [workspaceId,service.rows[0]!.id,confirmedStart,confirmedEnd],
    );
    const saved=await finalizeMariaVerifiedBooking({
      verificationId:hold.rows[0]!.id,expectedCodeHash:"synthetic-hash",
      bookingNote:"synthetic QA only",
    });
    expect(saved.ok).toBe(true);
    if(!saved.ok) throw new Error("Canonical finalization unexpectedly failed");
    expect((await manualBlocks())).toHaveLength(intervals.length-1);

    // Physical appointments still cannot overlap. The canonical exclusion
    // constraint and public-booking policy trigger are NOT bypassed.
    const conflictingStart=intervals.find(slot=>slot.clock==="07:30")!.startsAt;
    const conflictingEnd=new Date(Date.parse(conflictingStart)+180*60_000).toISOString();
    await expect(db!.query(
      "insert into bookings(workspace_id,customer_id,title,service,status,source,starts_at,ends_at) values($1,$2::uuid,'Conflicting synthetic booking','Synthetic independently managed start','requested','public_booking',$3::timestamptz,$4::timestamptz)",
      [workspaceId,customerId,conflictingStart,conflictingEnd],
    )).rejects.toMatchObject({code:"23P01"});

    // Moving the one physical booking after reopening another chosen start
    // must still respect the real overlap constraint but ignore unrelated
    // Maria manual closure rows held in the separate table.
    await changeMariaManualCalendar({date:day,mode:"open",clock:"06:00"});
    const movedStart=intervals[0]!.startsAt;
    const movedEnd=new Date(Date.parse(movedStart)+180*60_000).toISOString();
    const moved=await db!.query(
      "update bookings set starts_at=$1::timestamptz,ends_at=$2::timestamptz where id=$3::uuid returning id",
      [movedStart,movedEnd,saved.bookingId],
    );
    expect(moved.rowCount).toBe(1);
    expect(await manualBlocks()).toHaveLength(intervals.length-2);
    const stillBusy=await availability();
    expect(stillBusy).toEqual({ok:true,slots:[]});
  });

  it("does not invalidate an active OTP hold, including when the hold writer owns the same lock",async()=>{
    const service=await db!.query<{id:string}>(
      "insert into workspace_services(workspace_id,name,public_slug,duration_minutes,is_active,public_status) values($1,'Synthetic calendar service','maria-bridal-trial-2027',180,true,'published') returning id::text",
      [workspaceId],
    );
    const holdId=randomUUID();
    await db!.query("update workspace_services set buffer_before_minutes=30 where id=$1::uuid", [service.rows[0]!.id]);
    await db!.query(
      "insert into public_booking_verifications(id,workspace_id,public_booking_slug,customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at) values($1::uuid,$2::uuid,'makeup-by-maria','QA','qa@example.invalid',$3::uuid,'Synthetic', $4::timestamptz,$5::timestamptz,'synthetic-only',now()+interval '30 minutes')",
      [holdId,workspaceId,service.rows[0]!.id,intervals[4]!.startsAt,new Date(Date.parse(intervals[4]!.startsAt)+180*60_000).toISOString()],
    );
    expect((await readMariaManualCalendar(day)).slots.find(s=>s.clock==="07:30")?.holdCount).toBe(1);
    await expect(changeMariaManualCalendar({date:day,mode:"close",clock:"07:30"}))
      .rejects.toMatchObject({code:"conflict"});
    // An active hold is a pending customer reservation. No conflicting
    // manual row may commit while that hold can still be verified.
    await expect(changeMariaManualCalendar({date:day,mode:"close_day"}))
      .rejects.toMatchObject({code:"conflict"});
    expect(await manualBlocks()).toHaveLength(0);
    expect((await readMariaManualCalendar(day)).holdCount).toBe(1);
    const held=await db!.query("select count(*)::int as count from public_booking_verifications where id=$1::uuid and consumed_at is null",[holdId]);
    expect(held.rows[0]?.count).toBe(1);

    // After expiration, the manager may close the day and reopen it.
    await db!.query("update public_booking_verifications set expires_at=now()-interval '1 minute' where id=$1::uuid",[holdId]);
    expect((await changeMariaManualCalendar({date:day,mode:"close_day"})).affectedIntervals).toBe(9);
    expect((await changeMariaManualCalendar({date:day,mode:"open_day"})).affectedIntervals).toBe(9);
    expect(await manualBlocks()).toHaveLength(0);

    // A concurrently created hold is serialized with the calendar close.
    // The holder owns the Maria workspace lock while publishing its challenge.
    const lockClient=new Client({connectionString});
    await lockClient.connect();
    try{
      await lockClient.query("BEGIN");
      await lockClient.query("select pg_advisory_xact_lock(hashtextextended($1::text,713))",[workspaceId]);
      const pending=expect(changeMariaManualCalendar({date:day,mode:"close",clock:"06:00"}))
        .rejects.toMatchObject({code:"conflict"});
      await lockClient.query(
        "insert into public_booking_verifications(workspace_id,public_booking_slug,customer_name,customer_email,service_id,service_name,starts_at,ends_at,code_hash,expires_at) values($1::uuid,'makeup-by-maria','QA 2','qa@example.invalid',$2::uuid,'Synthetic',$3::timestamptz,$4::timestamptz,'synthetic-concurrent',now()+interval '30 minutes')",
        [workspaceId,service.rows[0]!.id,intervals[0]!.startsAt,
          new Date(Date.parse(intervals[0]!.startsAt)+180*60_000).toISOString()],
      );
      await lockClient.query("COMMIT");
      await pending;
      expect(await manualBlocks()).toHaveLength(0);
    }finally{
      await lockClient.query("ROLLBACK").catch(()=>undefined);
      await lockClient.end();
    }
  });

  it("can reopen all blocks hidden by later changes to regular working hours",async()=>{
    await changeMariaManualCalendar({date:day,mode:"close_day"});
    expect(await manualBlocks()).toHaveLength(9);
    await db!.query(
      "update workspace_booking_hours set closes_at='09:00' where workspace_id=$1 and weekday=5",
      [workspaceId],
    );
    const view=await readMariaManualCalendar(day);
    expect(view.slots).toHaveLength(7);
    expect(view.futureManualBlockCount).toBe(9);
    // Reopening all manually closed starts also works after the day is closed.
    await db!.query(
      "update workspace_booking_hours set opens_at=null,closes_at=null,is_closed=true where workspace_id=$1 and weekday=5",
      [workspaceId],
    );
    const closed=await readMariaManualCalendar(day);
    expect(closed.slots).toHaveLength(0);
    expect(closed.futureManualBlockCount).toBe(9);
    const result=await changeMariaManualCalendar({date:day,mode:"open_day"});
    expect(result.affectedIntervals).toBe(9);
    expect(await manualBlocks()).toHaveLength(0);
  });

  it("serializes simultaneous closes and writes only one matching start marker",async()=>{
    const results=await Promise.all([
      changeMariaManualCalendar({date:day,mode:"close",clock:"08:00"}),
      changeMariaManualCalendar({date:day,mode:"close",clock:"08:00"}),
    ]);
    expect(results.filter(x=>x.changed)).toHaveLength(1);
    expect(await manualBlocks()).toHaveLength(1);
  });

  it("denies Production, unapproved workspaces, other roles, missing entitlement, weekdays and past dates",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    await expect(changeMariaManualCalendar({date:day,mode:"close",clock:"06:00"}))
      .rejects.toMatchObject({code:"access"});
    vi.stubEnv("VERCEL_ENV","preview");
    access.slug="another-tenant";
    await expect(readMariaManualCalendar(day)).rejects.toMatchObject({code:"access"});
    access.slug="makeup-by-maria";access.role="member";
    await expect(changeMariaManualCalendar({date:day,mode:"close",clock:"06:00"}))
      .rejects.toMatchObject({code:"access"});
    access.role="owner";access.entitled=false;
    await expect(changeMariaManualCalendar({date:day,mode:"close",clock:"06:00"}))
      .rejects.toMatchObject({code:"access"});
    access.entitled=true;
    const monday=new Date(Date.parse(`${day}T12:00:00Z`)+3*86_400_000).toISOString().slice(0,10);
    await expect(changeMariaManualCalendar({date:monday,mode:"close",clock:"06:00"}))
      .rejects.toMatchObject({code:"date"});
    await expect(changeMariaManualCalendar({date:"2026-01-02",mode:"close",clock:"06:00"}))
      .rejects.toMatchObject({code:"date"});
    expect(await manualBlocks()).toHaveLength(0);
  });

  it("fails closed if a schedule edit commits while a close waits for the Maria lock",async()=>{
    const holder=new Client({connectionString});
    await holder.connect();
    let pending:Promise<{ok:boolean;error?:unknown}>|null=null;
    try{
      await holder.query("BEGIN");
      await holder.query("select pg_advisory_xact_lock(hashtextextended($1::text,713))",[workspaceId]);
      pending=changeMariaManualCalendar({date:day,mode:"close",clock:"08:30"})
        .then(()=>({ok:true}),error=>({ok:false,error}));
      // Wait for an actual advisory-lock waiter; no sleep-only race assumption.
      let queued=false;
      for(let attempt=0;attempt<60;attempt++){
        const state=await db!.query<{waiting:number}>(`
          select count(*)::int as waiting from pg_stat_activity
          where state='active' and wait_event_type='Lock'
            and wait_event='advisory' and query like '%pg_advisory_xact_lock%'
        `);
        if(Number(state.rows[0]?.waiting)>0){queued=true;break;}
        await delay(50);
      }
      expect(queued).toBe(true);
      await holder.query(
        "update workspace_booking_hours set closes_at='09:00' where workspace_id=$1 and weekday=5",
        [workspaceId],
      );
      await holder.query("COMMIT");
      const result=await pending;
      expect(result.ok).toBe(false);
      expect(result.error).toMatchObject({code:"conflict"});
      expect(await manualBlocks()).toHaveLength(0);
    }finally{
      await holder.query("ROLLBACK").catch(()=>undefined);
      await holder.end();
      if(pending) await pending;
    }
  });

  it("will not reopen a slot that already started even when preflight clock is stale",async()=>{
    // Test a past Friday using an intentionally earlier caller clock.
    // This reproduces the post-lock time boundary without wall-clock sleeps.
    const today=new Date();
    const offset=(today.getUTCDay()-5+7)%7 + 7;
    const friday=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()-offset));
    const date=friday.toISOString().slice(0,10);
    const slots=mariaCalendarIntervals(date,"06:00","10:00")!;
    const target=slots.find(x=>x.clock==="08:00")!;
    await db!.query(
      "insert into maria_manual_closed_starts(workspace_id,starts_at,created_by) values($1::uuid,$2::timestamptz,'synthetic-qa')",
      [workspaceId,target.startsAt],
    );
    const staleNow=new Date(Date.parse(target.startsAt)-60_000);
    const opened=await changeMariaManualCalendar({date,mode:"open",clock:"08:00"},staleNow);
    const entireDay=await changeMariaManualCalendar({date,mode:"open_day"},staleNow);
    expect(opened).toMatchObject({changed:false,affectedIntervals:0});
    expect(entireDay).toMatchObject({changed:false,affectedIntervals:0});
    const stillThere=await db!.query(
      "select starts_at from maria_manual_closed_starts where workspace_id=$1::uuid and starts_at=$2::timestamptz",
      [workspaceId,target.startsAt],
    );
    expect(stillThere.rowCount).toBe(1);
    // Isolate the synthetic fixture.
    await db!.query("delete from maria_manual_closed_starts where workspace_id=$1::uuid and starts_at=$2::timestamptz",[workspaceId,target.startsAt]);
  });

  it("refuses stale or closed working hours instead of silently re-opening them",async()=>{
    await db!.query("update workspace_booking_hours set is_closed=true,opens_at=null,closes_at=null where workspace_id=$1 and weekday=5",[workspaceId]);
    await expect(changeMariaManualCalendar({date:day,mode:"close",clock:"06:00"}))
      .rejects.toMatchObject({code:"schedule"});
    expect((await readMariaManualCalendar(day)).weeklyClosed).toBe(true);
    expect(await manualBlocks()).toHaveLength(0);
  });
});
