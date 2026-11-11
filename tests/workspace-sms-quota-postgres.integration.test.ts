import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyCanonicalProfferaMigrations } from "./helpers/postgres-canonical-schema";

const RUN = process.env.GITHUB_ACTIONS === "true" || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";
const docker = (args: string[]) => execFileSync("docker",args,{encoding:"utf8"}).trim();

(RUN ? describe.sequential : describe.skip)("Starter SMS quota under real concurrent PostgreSQL", () => {
  let container="";
  let db:Client;
  let pool:Pool;
  beforeAll(async () => {
    container="proffera-sms-quota-"+process.pid+"-"+Date.now();
    docker(["run","--rm","-d","--name",container,
      "-e","POSTGRES_PASSWORD=postgres","-e","POSTGRES_USER=postgres",
      "-e","POSTGRES_DB=proffera_test","-p","127.0.0.1::5432",
      "postgis/postgis:16-3.5-alpine"]);
    const port=docker(["port",container,"5432/tcp"]).split(/\r?\n/u)[0]?.match(/:(\d+)$/u)?.[1];
    if(!port)throw Error("Isolated SMS test port missing");
    const connectionString="postgres://postgres:postgres@127.0.0.1:"+port+"/proffera_test";
    let ready=false;
    for(let i=0;i<80;i++){
      const probe=new Client({connectionString});
      try{await probe.connect();await probe.query("select 1");await probe.end();ready=true;break;}
      catch{await probe.end().catch(()=>undefined);await delay(500);}
    }
    if(!ready)throw Error("Isolated SMS database not ready");
    db=new Client({connectionString});await db.connect();
    pool=new Pool({connectionString,max:24});
    await applyCanonicalProfferaMigrations(db);
  },180_000);
  afterAll(async()=>{
    await pool?.end().catch(()=>undefined);await db?.end().catch(()=>undefined);
    if(container){try{docker(["stop",container]);}catch{/* removed */}}
  },30_000);

  async function setup(limit:50|100|null, status="active") {
    const workspaceId=randomUUID(),planId=randomUUID();
    await db.query(
      "insert into workspaces(id,slug,name,status) values($1::uuid,$2,$3,'active')",
      [workspaceId,"synthetic-sms-"+workspaceId.slice(0,8),"Synthetic SMS"]);
    await db.query(
      "insert into workspace_plans(id,workspace_id,plan_key,status,current_period_start,current_period_end) values($1::uuid,$2::uuid,'starter','active',now()-interval '1 day',now()+interval '29 days')",
      [planId,workspaceId]);
    await db.query(
      "insert into workspace_feature_flags(id,workspace_id,feature_key,enabled) values($1::uuid,$2::uuid,'sms',true)",
      [randomUUID(),workspaceId]);
    await db.query(
      "insert into workspace_billing_subscriptions(id,workspace_id,workspace_plan_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,status,sms_monthly_limit,current_period_start,current_period_end) values($1::uuid,$2::uuid,$3::uuid,$4,$5,'price_test_starter',$6,$7,now()-interval '1 day',now()+interval '29 days')",
      [randomUUID(),workspaceId,planId,"cus_"+workspaceId,"sub_"+workspaceId,status,limit]);
    return workspaceId;
  }

  async function reserve(workspaceId:string,key:string,units=1){
    const r=await pool.query<{result:string}>("select reserve_workspace_starter_sms($1::uuid,$2::text,$3::integer) as result",
      [workspaceId,key,units]);
    return r.rows[0]!.result;
  }

  it("reserves at most 50 units despite 60 concurrent requests", async()=>{
    const ws=await setup(50);
    const results=await Promise.all(Array.from({length:60},(_,i)=>reserve(ws,"message-"+i)));
    expect(results.filter(v=>v==="reserved")).toHaveLength(50);
    expect(results.filter(v=>v==="quota_exhausted")).toHaveLength(10);
    const count=await db.query<{used:string}>(
      "select sum(units)::text as used from workspace_sms_dispatches where workspace_id=$1::uuid",
      [ws]);
    expect(Number(count.rows[0]?.used)).toBe(50);
    expect(await reserve(ws,"message-1")).toBe("duplicate");
  },120_000);

  it("allows up to 100 full-price units and no more",async()=>{
    const ws=await setup(100);
    const results=await Promise.all(Array.from({length:108},(_,i)=>reserve(ws,"full-price-"+i)));
    expect(results.filter(v=>v==="reserved")).toHaveLength(100);
    expect(results.filter(v=>v==="quota_exhausted")).toHaveLength(8);
  },120_000);

  it("counts Unicode multi-segment messages atomically",async()=>{
    const ws=await setup(50);
    const results=await Promise.all(Array.from({length:26},(_,i)=>reserve(ws,"unicode-"+i,2)));
    expect(results.filter(v=>v==="reserved")).toHaveLength(25);
    expect(results.filter(v=>v==="quota_exhausted")).toHaveLength(1);
  },120_000);

  it("keeps ambiguous provider delivery charged while explicitly rejected delivery frees units",async()=>{
    const ws=await setup(50);
    for(let i=0;i<50;i++)expect(await reserve(ws,"sequence-"+i)).toBe("reserved");
    await db.query("update workspace_sms_dispatches set status='uncertain' where workspace_id=$1::uuid and delivery_key='sequence-0'",[ws]);
    expect(await reserve(ws,"after-uncertain")).toBe("quota_exhausted");
    await db.query("update workspace_sms_dispatches set status='rejected' where workspace_id=$1::uuid and delivery_key='sequence-1'",[ws]);
    expect(await reserve(ws,"after-reject")).toBe("reserved");
  },120_000);

  it("does not grant quota to pending, cancelled or unknown-discount Starter",async()=>{
    const pending=await setup(50,"pending");
    const unknown=await setup(null);
    expect(await reserve(pending,"pending-key")).toBe("not_entitled");
    expect(await reserve(unknown,"unknown-key")).toBe("not_entitled");
  });

  it("isolates identically named send keys by workspace",async()=>{
    const left=await setup(50),right=await setup(50);
    expect(await reserve(left,"identical-key")).toBe("reserved");
    expect(await reserve(right,"identical-key")).toBe("reserved");
  });
});
