import Link from "next/link";
import { Store } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasWorkspaceFeature } from "@/lib/workspace-entitlements";

export const dynamic = "force-dynamic";

function pageUrl(input?: { updated?: boolean; error?: string }) {
  const query = new URLSearchParams();
  if (input?.updated) query.set("updated", "1");
  if (input?.error) query.set("error", input.error);
  return `/dashboard/installningar/foretagssida${query.size ? `?${query}` : ""}`;
}

async function savePublicBusinessSettings(formData: FormData) {
  "use server";
  const sql = getSql();
  const access = await getUserWorkspaceAccess();
  if (!sql || !access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  const publicHomeMode = formData.get("public_home_mode") === "website" ? "website" : "booking";
  const businessIntro = String(formData.get("business_intro") ?? "").trim();
  if (businessIntro.length > 2000) redirect(pageUrl({ error: "intro" }));

  if (publicHomeMode === "website" && !(await hasWorkspaceFeature("website_builder"))) {
    redirect(pageUrl({ error: "plan" }));
  }

  await sql`insert into workspace_experience_settings (workspace_id) values (${access.workspaceId}::uuid) on conflict (workspace_id) do nothing`;
  await sql`
    update workspace_experience_settings
    set public_home_mode = ${publicHomeMode}, business_intro = ${businessIntro}, updated_at = now()
    where workspace_id = ${access.workspaceId}::uuid
  `;
  redirect(pageUrl({ updated: true }));
}

export default async function PublicBusinessSettingsPage({ searchParams }: { searchParams?: Promise<{ updated?: string; error?: string }> }) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const sql = getSql();
  if (!sql) redirect("/dashboard");

  const [workspaceRows, experienceRows, builderEnabled, customDomainEnabled] = await Promise.all([
    sql`select slug, public_booking_slug from workspaces where id = ${access.workspaceId}::uuid limit 1`,
    sql`select public_home_mode, business_intro, custom_domain, custom_domain_status from workspace_experience_settings where workspace_id = ${access.workspaceId}::uuid limit 1`,
    hasWorkspaceFeature("website_builder"),
    hasWorkspaceFeature("custom_domain"),
  ]);
  const workspace = workspaceRows[0];
  if (!workspace) redirect("/dashboard");
  const experience = experienceRows[0];
  const mode = experience?.public_home_mode === "website" ? "website" : "booking";
  const publicUrl = `/foretag/${encodeURIComponent(String(workspace.slug))}`;
  const bookingUrl = workspace.public_booking_slug ? `/boka/${encodeURIComponent(String(workspace.public_booking_slug))}` : "";
  const params = searchParams ? await searchParams : {};

  return (
    <div className="grid gap-5">
      <DashboardPageHeader
        eyebrow="Företagssida"
        title="Din publika företagsyta"
        description="Tjänster, bokning, offert, omdömen, galleri och kontakt använder samma workspace-data. Ingen separat tjänstekatalog behöver underhållas."
        icon={Store}
        actions={<div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/dashboard/installningar/foretagssida/platser" className="inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand-deep">Hantera företagsplatser</Link>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand-deep px-4 py-2.5 text-sm font-bold text-white">Förhandsvisa företagssida</a>
        </div>}
      />

      {params.updated === "1" ? <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 text-sm font-bold text-brand">Företagssidans inställningar sparades.</p> : null}
      {params.error === "intro" ? <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-bold text-danger">Presentationstexten är för lång.</p> : null}
      {params.error === "plan" ? <p className="rounded-card border border-[#f4c7ba] bg-[#fff5f2] p-4 text-sm font-bold text-danger">Företagssidan är inte aktiverad i nuvarande plan eller modulåtkomst.</p> : null}

      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <form action={savePublicBusinessSettings} className="grid gap-5">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Startsida på egen domän</p><h2 className="mt-2 text-xl font-black text-ink">Välj vad besökaren möter först</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Befintliga workspaces fortsätter med bokningssidan tills du aktivt väljer företagssidan.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-2xl border p-4 ${mode === "booking" ? "border-brand bg-brand-soft" : "border-line"}`}><input type="radio" name="public_home_mode" value="booking" defaultChecked={mode === "booking"} className="mr-2" /><strong className="text-ink">Bokningssida</strong><p className="mt-2 text-xs leading-5 text-ink-muted">Domänens startsida öppnar direkt onlinebokningen.</p></label>
              <label className={`cursor-pointer rounded-2xl border p-4 ${mode === "website" ? "border-brand bg-brand-soft" : "border-line"}`}><input type="radio" name="public_home_mode" value="website" defaultChecked={mode === "website"} disabled={!builderEnabled} className="mr-2" /><strong className="text-ink">Företagssida</strong><p className="mt-2 text-xs leading-5 text-ink-muted">Visar tjänster, omdömen, galleri och flera kundvägar.</p>{!builderEnabled ? <span className="mt-2 inline-block text-xs font-bold text-[#8f6816]">Kräver Webbplats för företag</span> : null}</label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-ink-muted">Kort presentation<textarea name="business_intro" maxLength={2000} rows={6} defaultValue={String(experience?.business_intro ?? "")} placeholder="Berätta kort vad företaget gör, för vem och i vilket område." className="rounded-control border border-line px-4 py-3 font-normal text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /></label>
            <button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1469d8] px-5 font-black text-white">Spara företagssida</button>
          </form>

          <aside className="grid content-start gap-4">
            <div className="rounded-card bg-surface-subtle p-5 ring-1 ring-line"><p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Publik adress</p><a href={publicUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all font-bold text-brand">{publicUrl}</a></div>
            {bookingUrl ? <div className="rounded-card bg-surface-subtle p-5 ring-1 ring-line"><p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Bokningsadress</p><a href={bookingUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all font-bold text-brand">{bookingUrl}</a></div> : null}
            {customDomainEnabled && experience?.custom_domain ? <div className="rounded-card bg-surface-subtle p-5 ring-1 ring-line"><p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Egen domän</p><p className="mt-2 break-all font-bold text-ink">{String(experience.custom_domain)}</p><p className="mt-2 text-xs text-ink-muted">Startsidan använder läget <strong>{mode === "website" ? "Företagssida" : "Bokningssida"}</strong>. Domänkopplingen ändras inte.</p></div> : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
