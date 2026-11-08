import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state=vi.hoisted(()=>({
  role:"owner",slug:"makeup-by-maria",workspaceId:"11111111-2222-4333-8444-555555555555",
  productionReady:false,readinessWorkspaceId:null as string|null,
  query:vi.fn(),transaction:vi.fn(),
}));
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error("REDIRECT:"+url)}}));
vi.mock("@/lib/db/server",()=>({
  getSql:()=>Object.assign(state.query,{transaction:state.transaction}),
}));
vi.mock("@/lib/workspace-access",()=>({
  getUserWorkspaceAccess:async()=>({ok:true,role:state.role,workspaceSlug:state.slug,
    workspaceId:state.workspaceId,userId:"synthetic-maria-owner"}),
  canManageWorkspaceSettings:(access:{role:string})=>["owner","admin"].includes(access.role),
}));
vi.mock("@/lib/maria-booking-runtime",()=>({
  getMariaBookingReadiness:async()=>state.productionReady
    ? {enabled:true,workspaceId:state.readinessWorkspaceId ?? state.workspaceId,publicSlug:"makeup-by-maria"}
    : {enabled:false},
}));
import { saveMariaScheduleAction } from "./schedule-actions";

function form(){
  const data=new FormData();
  data.set("duration_minutes","180");data.set("buffer_after_minutes","30");
  for(const day of [5,6,0]){
    data.set(`day_${day}_first`,"08:00");data.set(`day_${day}_last`,"16:00");
  }
  return data;
}
beforeEach(()=>{
  vi.resetAllMocks();
  state.role="owner";state.slug="makeup-by-maria";state.productionReady=false;
  state.readinessWorkspaceId=null;
  state.query.mockReturnValue({});
  state.transaction.mockResolvedValue([]);
});
afterEach(()=>vi.unstubAllEnvs());

describe("Maria manager's Production weekend schedule is disabled until the real booking lifecycle is ready",()=>{
  it("rejects Production before the schema/lifecycle gate without calling SQL",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    await expect(saveMariaScheduleAction(form())).rejects.toThrow("REDIRECT:/dashboard");
    expect(state.query).not.toHaveBeenCalled();
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("rejects unrelated workspaces and non-manager roles even with all Production switches",async()=>{
    vi.stubEnv("VERCEL_ENV","production");state.productionReady=true;
    state.slug="another-tenant";
    await expect(saveMariaScheduleAction(form())).rejects.toThrow("REDIRECT:/dashboard");
    state.slug="makeup-by-maria";state.role="staff";
    await expect(saveMariaScheduleAction(form())).rejects.toThrow("REDIRECT:/dashboard");
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("refuses a ready Production flag bound to another workspace before writing",async()=>{
    vi.stubEnv("VERCEL_ENV","production");state.productionReady=true;
    state.readinessWorkspaceId="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    await expect(saveMariaScheduleAction(form())).rejects.toThrow("REDIRECT:/dashboard");
    expect(state.query).not.toHaveBeenCalled();
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("executes the same locked update in a ready Production workspace",async()=>{
    vi.stubEnv("VERCEL_ENV","production");state.productionReady=true;
    await expect(saveMariaScheduleAction(form())).rejects.toThrow("REDIRECT:/dashboard/maria?updated=schedule#tider");
    expect(state.transaction).toHaveBeenCalledOnce();
    const [queries]=state.transaction.mock.calls[0] as [unknown[]];
    expect(queries).toHaveLength(7);
    const strings=state.query.mock.calls.map(c=>Array.from(c[0] as TemplateStringsArray).join("?"));
    expect(strings[0]).toContain("pg_advisory_xact_lock");
    expect(strings.some(s=>s.includes("update workspace_services"))).toBe(true);
    expect(strings.filter(s=>s.includes("insert into workspace_booking_hours"))).toHaveLength(3);
  });
  it("never updates service durations on an hours-only save",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    const data=form();
    data.set("original_duration_minutes","180");
    data.set("original_buffer_after_minutes","30");
    await expect(saveMariaScheduleAction(data)).rejects.toThrow("REDIRECT:/dashboard/maria?updated=schedule#tider");
    const statements=state.query.mock.calls.map(c=>Array.from(c[0] as TemplateStringsArray).join("?"));
    expect(statements.some(s=>s.includes("update workspace_services"))).toBe(false);
    expect(statements.filter(s=>s.includes("insert into workspace_booking_hours"))).toHaveLength(3);
    expect(state.transaction.mock.calls[0]?.[0]).toHaveLength(6);
  });
  it("checks for active verification holds before a duration edit",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    await expect(saveMariaScheduleAction(form())).rejects.toThrow("REDIRECT:/dashboard/maria?updated=schedule#tider");
    const statements=state.query.mock.calls.map(c=>Array.from(c[0] as TemplateStringsArray).join("?"));
    expect(statements.some(s=>s.includes("public_booking_verifications hold"))).toBe(true);
  });
  it("preserves isolated Preview manager schedule behavior",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    await expect(saveMariaScheduleAction(form())).rejects.toThrow("REDIRECT:/dashboard/maria?updated=schedule#tider");
    expect(state.transaction).toHaveBeenCalledOnce();
  });
});
