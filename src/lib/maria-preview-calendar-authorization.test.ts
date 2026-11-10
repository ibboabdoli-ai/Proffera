import { afterEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(()=>({slug:"makeup-by-maria",role:"owner",ok:true}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db/server",()=>({getSql:()=>null}));
vi.mock("@/lib/workspace-access",()=>({
  getUserWorkspaceAccess:async()=>({
    ok:fixture.ok,workspaceId:"synthetic-qa",workspaceSlug:fixture.slug,
    role:fixture.role,userId:"synthetic-owner"
  }),
  canManageWorkspaceSettings:(access:{role:string})=>["owner","admin"].includes(access.role),
}));
vi.mock("@/lib/workspace-module-access",()=>({
  hasDashboardModuleAccess:()=>{throw Error("No paid booking entitlement may be checked for Maria Preview-only calendar")},
}));
import { changeMariaManualCalendar, readMariaManualCalendar } from "./maria-manual-calendar";

afterEach(()=>{
  vi.unstubAllEnvs();
  fixture.ok=true;fixture.role="owner";fixture.slug="makeup-by-maria";
});
describe("Maria-only Preview calendar authorization before database operations",()=>{
  it("accepts Maria owner without paid booking feature (then fails closed on unavailable database)",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    await expect(readMariaManualCalendar("2026-12-04")).rejects.toMatchObject({code:"database"});
    await expect(changeMariaManualCalendar({date:"2026-12-04",mode:"close",clock:"07:00"})).rejects.toMatchObject({code:"database"});
  });
  it("rejects all users outside Preview and tenants other than Maria",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    await expect(readMariaManualCalendar("2026-12-04")).rejects.toMatchObject({code:"access"});
    vi.stubEnv("VERCEL_ENV","preview");
    fixture.slug="another-workspace";
    await expect(readMariaManualCalendar("2026-12-04")).rejects.toMatchObject({code:"access"});
  });
  it("rejects Maria workspace members without manager rights or missing workspace access",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    fixture.role="member";
    await expect(readMariaManualCalendar("2026-12-04")).rejects.toMatchObject({code:"access"});
    fixture.ok=false;fixture.role="owner";
    await expect(readMariaManualCalendar("2026-12-04")).rejects.toMatchObject({code:"access"});
  });
});
