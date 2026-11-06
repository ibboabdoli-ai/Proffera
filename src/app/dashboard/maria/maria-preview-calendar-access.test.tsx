import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state=vi.hoisted(()=>({slug:"makeup-by-maria",role:"owner"}));
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error("REDIRECT "+url)}}));
vi.mock("@/lib/workspace-access",()=>({
  getUserWorkspaceAccess:async()=>({ok:true,workspaceSlug:state.slug,role:state.role,workspaceId:"qa"}),
  canManageWorkspaceSettings:(access:{role:string})=>["owner","admin"].includes(access.role),
}));
vi.mock("@/lib/workspace-services-db",()=>({getDashboardWorkspaceServices:async()=>[]}));
vi.mock("@/lib/workspace-booking-hours-db",()=>({getDashboardWorkspaceBookingHours:async()=>({hours:[]})}));
vi.mock("@/lib/maria-preview-booking",()=>({getMariaPreviewBookingReadiness:async()=>({enabled:false})}));
vi.mock("@/lib/workspace-module-access",()=>({
  hasDashboardModuleAccess:()=>{throw Error("No paid booking entitlement may be queried for this preview-only Maria editor")},
  getDashboardModuleAccess:async()=>[],
  getDashboardEnabledFeatureKeys:async()=>[],
}));
vi.mock("@/lib/dashboard-db",()=>({
  getDashboardStats:async()=>({
    customersCount:0,activeCustomersCount:0,bookingsCount:0,
    confirmedBookingsCount:0,customerEventsCount:0,
  }),
}));
vi.mock("./actions",()=>({saveMariaYearAction:async()=>{}}));
vi.mock("./schedule-actions",()=>({saveMariaScheduleAction:async()=>{}}));

import MariaSiteDashboardPage from "./page";
import DashboardPage from "../page";

afterEach(()=>{vi.unstubAllEnvs();state.slug="makeup-by-maria";state.role="owner"});
describe("Maria preview calendar visible without paid booking",()=>{
  it("routes the Maria manager workspace directly from /dashboard in Preview and Production",async()=>{
    for (const env of ["preview","production"]) {
      vi.stubEnv("VERCEL_ENV",env);
      const result=await DashboardPage({searchParams:Promise.resolve({})});
      expect(result.type).toBe(MariaSiteDashboardPage);
    }
  });
  it.each([
    ["preview","other-workspace","owner"],
    ["production","other-workspace","staff"],
    ["preview","makeup-by-maria","viewer"],
    ["production","makeup-by-maria","staff"],
    ["development","makeup-by-maria","owner"],
    ["unset","makeup-by-maria","owner"],
  ] as const)(
    "keeps normal /dashboard for %s environment, workspace %s, role %s",
    async (env,slug,role)=>{
      state.slug=slug;
      state.role=role;
      vi.stubEnv("VERCEL_ENV",env==="unset"?undefined:env);
      const page=await DashboardPage({searchParams:Promise.resolve({})});
      expect(page.type).not.toBe(MariaSiteDashboardPage);
      const html=renderToStaticMarkup(page);
      expect(html).toContain("Din arbetsyta är redo när modulerna aktiveras.");
      expect(html).not.toContain("Min bokningsöversikt");
    },
  );
  it("shows manager calendar link twice but keeps public booking disabled",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    const html=renderToStaticMarkup(await MariaSiteDashboardPage({searchParams:Promise.resolve({})}));
    expect(html.match(/href="\/dashboard\/maria\/kalender"/g)).toHaveLength(2);
    expect(html).toContain("Hantera dagens tider");
    expect(html).toContain("Den publika bokningen är inte aktiverad.");
  });
  it("shows a read-only Maria overview in Production without Preview booking controls",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    const html=renderToStaticMarkup(await MariaSiteDashboardPage({searchParams:Promise.resolve({})}));
    expect(html).toContain("Min bokningsöversikt");
    expect(html).toContain("Onlinebokningen är ännu inte aktiverad.");
    expect(html).not.toContain("Spara bokningstider");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('href="/dashboard/maria/kalender"');
  });
  it("never exposes the production Maria view to another workspace or non-manager",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    state.slug="another-company";
    await expect(MariaSiteDashboardPage({searchParams:Promise.resolve({})})).rejects.toThrow("REDIRECT /dashboard");
    state.slug="makeup-by-maria";state.role="staff";
    await expect(MariaSiteDashboardPage({searchParams:Promise.resolve({})})).rejects.toThrow("REDIRECT /dashboard");
  });
  it("never exposes Maria calendar controls to another tenant or nonmanager",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    state.slug="another-company";
    await expect(MariaSiteDashboardPage({searchParams:Promise.resolve({})})).rejects.toThrow("REDIRECT /dashboard");
    state.slug="makeup-by-maria";state.role="member";
    await expect(MariaSiteDashboardPage({searchParams:Promise.resolve({})})).rejects.toThrow("REDIRECT /dashboard");
  });
});
