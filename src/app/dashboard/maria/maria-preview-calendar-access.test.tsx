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
}));
vi.mock("./actions",()=>({saveMariaYearAction:async()=>{}}));
vi.mock("./schedule-actions",()=>({saveMariaScheduleAction:async()=>{}}));

import MariaSiteDashboardPage from "./page";

afterEach(()=>{vi.unstubAllEnvs();state.slug="makeup-by-maria";state.role="owner"});
describe("Maria preview calendar visible without paid booking",()=>{
  it("shows manager calendar link twice but keeps public booking disabled",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    const html=renderToStaticMarkup(await MariaSiteDashboardPage({searchParams:Promise.resolve({})}));
    expect(html.match(/href="\/dashboard\/maria\/kalender"/g)).toHaveLength(2);
    expect(html).toContain("Hantera dagens tider");
    expect(html).toContain("Den publika bokningen är inte aktiverad.");
  });
  it("never exposes Maria Preview dashboard outside Preview",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
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
