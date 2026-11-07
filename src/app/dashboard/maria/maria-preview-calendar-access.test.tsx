import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mariaDefaultCardCopy } from "@/lib/maria-default-card-copy";

const state=vi.hoisted(()=>({slug:"makeup-by-maria",role:"owner",productionEditorReady:false,serviceReadFailure:false}));
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error("REDIRECT "+url)}}));
vi.mock("@/lib/workspace-access",()=>({
  getUserWorkspaceAccess:async()=>({ok:true,workspaceSlug:state.slug,role:state.role,workspaceId:"qa"}),
  canManageWorkspaceSettings:(access:{role:string})=>["owner","admin"].includes(access.role),
}));
vi.mock("@/lib/workspace-services-db",()=>({
  getDashboardWorkspaceServices:async(options?:{strict?:boolean})=>{
    if(state.serviceReadFailure && options?.strict) throw Error("Synthetic service DB read failed");
    return [];
  },
}));
vi.mock("@/lib/workspace-booking-hours-db",()=>({getDashboardWorkspaceBookingHours:async()=>({hours:[]})}));
vi.mock("@/lib/maria-preview-booking",()=>({getMariaPreviewBookingReadiness:async()=>({enabled:false})}));
vi.mock("@/lib/maria-production-year-editor",()=>({
  isMariaProductionYearEditorReady:async()=>state.productionEditorReady,
}));
vi.mock("@/lib/maria-card-translations-db",()=>({
  readMariaCardTranslations:async()=>new Map([
    ["maria-bridal-trial-2026",{en:"Synthetic English card",ar:"نص تجريبي عربي"}],
  ]),
}));
vi.mock("@/lib/workspace-module-access",()=>({
  hasDashboardModuleAccess:()=>{throw Error("No paid booking entitlement may be queried for this preview-only Maria editor")},
  getDashboardModuleAccess:async()=>[],
  getDashboardEnabledFeatureKeys:async()=>[],
}));
vi.mock("@/components/dashboard/business-calendar",()=>({
  BusinessCalendar:({allowDragAndDrop,moveDisabledReason}:{allowDragAndDrop?:boolean;moveDisabledReason?:string})=><div data-calendar-drag={String(allowDragAndDrop)} data-move-reason={moveDisabledReason??"none"}/>,
}));
vi.mock("@/lib/dashboard-calendar",()=>({getDashboardCalendarEvents:async()=>[]}));
vi.mock("@/lib/workspace-settings-db",()=>({getDashboardWorkspaceSettings:async()=>({timeZone:"Europe/Stockholm"})}));
vi.mock("@/lib/dashboard-bookings-db",()=>({getDashboardBookingsInStockholm:async()=>[]}));
vi.mock("@/lib/maria-manual-swish",()=>({readMariaManualSwishStatuses:async()=>({ok:true,entries:{}})}));
vi.mock("@/lib/dashboard-db",()=>({
  getDashboardCustomerOptions:async()=>[],
  getDashboardStats:async()=>({
    customersCount:0,activeCustomersCount:0,bookingsCount:0,
    confirmedBookingsCount:0,customerEventsCount:0,
  }),
}));
vi.mock("./actions",()=>({saveMariaYearAction:async()=>{}}));
vi.mock("./production-year-actions",()=>({saveMariaProductionYearAction:async()=>{}}));
vi.mock("./schedule-actions",()=>({saveMariaScheduleAction:async()=>{}}));

import MariaSiteDashboardPage from "./page";
import DashboardPage from "../page";
import CalendarPage from "../kalender/page";
import BookingsPage from "../bokningar/page";
import NewBookingPage from "../bokningar/ny/page";

afterEach(()=>{vi.unstubAllEnvs();state.slug="makeup-by-maria";state.role="owner";state.productionEditorReady=false;state.serviceReadFailure=false});
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
  it("shows all three independently editable card-copy languages in Preview only",async()=>{
    vi.stubEnv("VERCEL_ENV","preview");
    const html=renderToStaticMarkup(await MariaSiteDashboardPage({searchParams:Promise.resolve({year:"2026"})}));
    for(const name of [
      "trial_description", "trial_description_en", "trial_description_ar",
      "without_description", "without_description_en", "without_description_ar",
    ])expect(html).toContain(`name="${name}"`);
    expect(html).toContain('lang="ar" dir="rtl"');
    // Persisted custom text takes priority; unedited languages display the
    // real customer-facing default instead of an empty textarea placeholder.
    expect(html).toContain("Synthetic English card");
    expect(html).toContain("نص تجريبي عربي");
    expect(html).toContain(mariaDefaultCardCopy["without-trial"].en);
    expect(html).toContain(mariaDefaultCardCopy["without-trial"].ar);
  });
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
  it("renders the exact year-by-year three-language price editor in Production only after schema gate",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED","true");
    state.productionEditorReady=true;
    const html=renderToStaticMarkup(await MariaSiteDashboardPage({searchParams:Promise.resolve({year:"2030"})}));
    expect(html).toContain('name="year" value="2030"');
    for(const name of [
      "trial", "without",
      "trial_description", "trial_description_en", "trial_description_ar",
      "without_description", "without_description_en", "without_description_ar",
    ])expect(html).toContain(`name="${name}"`);
    expect(html).toContain("Spara 2030");
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).not.toContain('name="enabled"');
    expect(html).not.toContain("Spara bokningstider");
    expect(html).not.toContain('href="/dashboard/maria/kalender"');
    expect(html).not.toContain("Hantera bokningar");
  });
  it("fails closed instead of showing editable defaults when Production service read fails",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED","true");
    state.productionEditorReady=true;
    state.serviceReadFailure=true;
    await expect(MariaSiteDashboardPage({searchParams:Promise.resolve({year:"2026"})}))
      .rejects.toThrow("Synthetic service DB read failed");
  });
  it("keeps Production year editor locked even if the workspace is authorized while migration/flag is off",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    state.productionEditorReady=false;
    const html=renderToStaticMarkup(await MariaSiteDashboardPage({searchParams:Promise.resolve({year:"2030"})}));
    expect(html).not.toContain('name="trial_description_en"');
    expect(html).not.toContain('name="trial"');
    expect(html).toContain("Årsredigering öppnas efter godkänd databasmigrering");
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


describe("Maria generic calendar controls remain isolated",()=>{
  it.each([
    ["preview","makeup-by-maria",false],
    ["production","makeup-by-maria",false],
    ["preview","another-workspace",true],
    ["production","another-workspace",true],
    ["development","makeup-by-maria",true],
  ] as const)("calendar in %s for %s permits generic moves: %s",async(env,slug,enabled)=>{
    vi.stubEnv("VERCEL_ENV",env);
    state.slug=slug;
    const html=renderToStaticMarkup(await CalendarPage({searchParams:Promise.resolve({})}));
    expect(html).toContain(`data-calendar-drag="${enabled}"`);
    const expectedReason = slug === "makeup-by-maria" && env === "production"
      ? "maria_production_readonly" : slug === "makeup-by-maria" && env === "preview"
        ? "maria_preview_details" : "none";
    expect(html).toContain(`data-move-reason="${expectedReason}"`);
    expect(html.includes('href="/dashboard/bokningar/ny"')).toBe(enabled);
    expect(html.includes('href="/dashboard/bokningar/blockera"')).toBe(enabled);
  });
});


describe("Maria Production generic booking creation UI",()=>{
  it("hides new-booking actions and denies the direct form for Maria Production",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    const html=renderToStaticMarkup(await BookingsPage({searchParams:Promise.resolve({})}));
    expect(html).not.toContain('href="/dashboard/bokningar/ny"');
    await expect(NewBookingPage({searchParams:Promise.resolve({})}))
      .rejects.toThrow("REDIRECT /dashboard/bokningar");
  });
  it("keeps the existing new-booking link for unrelated Production workspaces",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    state.slug="unrelated-company";
    const html=renderToStaticMarkup(await BookingsPage({searchParams:Promise.resolve({})}));
    expect(html).toContain('href="/dashboard/bokningar/ny"');
  });
});
