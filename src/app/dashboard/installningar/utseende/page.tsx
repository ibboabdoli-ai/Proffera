import { redirect } from "next/navigation";

import { getWorkspaceExperienceSettings, updateWorkspaceExperienceSettings } from "@/lib/workspace-experience";
import { hasWorkspaceFeature } from "@/lib/workspace-entitlements";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

async function saveAppearance(formData: FormData) {
  "use server";
  const canUseBuilder = await hasWorkspaceFeature("website_builder");
  if (!canUseBuilder) redirect("/dashboard/installningar/funktioner");
  await updateWorkspaceExperienceSettings({
    themeKey: String(formData.get("themeKey") ?? "clean"),
    primaryColor: String(formData.get("primaryColor") ?? "#17452f"),
    accentColor: String(formData.get("accentColor") ?? "#d9b44a"),
    appearance: formData.get("appearance") === "dark" ? "dark" : "light",
    heroEnabled: formData.get("heroEnabled") === "on",
    servicesEnabled: formData.get("servicesEnabled") === "on",
    staffEnabled: formData.get("staffEnabled") === "on",
    reviewsEnabled: formData.get("reviewsEnabled") === "on",
    galleryEnabled: formData.get("galleryEnabled") === "on",
    contactEnabled: formData.get("contactEnabled") === "on",
    faqEnabled: formData.get("faqEnabled") === "on",
    chatbotEnabled: formData.get("chatbotEnabled") === "on",
    logoUrl: String(formData.get("logoUrl") ?? ""),
    heroImageUrl: String(formData.get("heroImageUrl") ?? ""),
    heroVideoUrl: String(formData.get("heroVideoUrl") ?? ""),
    customDomain: String(formData.get("customDomain") ?? ""),
    customDomainStatus: "disconnected",
  });
  redirect("/dashboard/installningar/utseende?updated=1");
}

const toggles = [
  ["heroEnabled", "Hero"], ["servicesEnabled", "Tjänster"], ["staffEnabled", "Medarbetare"], ["reviewsEnabled", "Omdömen"],
  ["galleryEnabled", "Galleri"], ["contactEnabled", "Kontakt"], ["faqEnabled", "FAQ"], ["chatbotEnabled", "AI-chatt på bokningssidan"],
] as const;

export default async function AppearanceSettingsPage({ searchParams }: { searchParams?: Promise<{ updated?: string }> }) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const settings = await getWorkspaceExperienceSettings();
  const builderEnabled = await hasWorkspaceFeature("website_builder");
  const params = searchParams ? await searchParams : {};

  return <div className="grid gap-6">
    <header className="rounded-[28px] bg-[#173e2b] p-7 text-white"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Bokningssida</p><h1 className="mt-2 text-3xl font-bold">Tema och visuellt innehåll</h1><p className="mt-3 text-sm leading-7 text-white/80">Samma verktyg finns för alla arbetsytor. Planen avgör vilka delar som kan publiceras.</p></header>
    {params.updated === "1" ? <p className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">Utseendet sparades.</p> : null}
    {!builderEnabled ? <section className="rounded-2xl border border-[#ead9ac] bg-[#fff9e9] p-5"><p className="font-bold text-[#6f5512]">Sidbyggaren är låst för nuvarande plan.</p><p className="mt-2 text-sm text-[#765f28]">Starta en 14-dagars testperiod eller uppgradera planen. Dina befintliga inställningar behålls.</p><a href="/dashboard/installningar/funktioner" className="mt-4 inline-flex rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white">Visa funktioner</a></section> : null}
    <form action={saveAppearance} className={`grid gap-6 ${builderEnabled ? "" : "pointer-events-none opacity-55"}`}>
      <section className="grid gap-4 rounded-[24px] border border-[#dfe6df] bg-white p-6 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">Tema<select name="themeKey" defaultValue={settings.themeKey} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal"><option value="clean">Clean</option><option value="salon">Salon</option><option value="premium">Premium</option><option value="modern">Modern</option><option value="minimal">Minimal</option></select></label>
        <label className="grid gap-2 text-sm font-bold">Läge<select name="appearance" defaultValue={settings.appearance} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal"><option value="light">Ljust</option><option value="dark">Mörkt</option></select></label>
        <label className="grid gap-2 text-sm font-bold">Primär färg<input name="primaryColor" type="color" defaultValue={settings.primaryColor} className="h-12 w-full rounded-xl border border-[#d7dfd7] p-1" /></label>
        <label className="grid gap-2 text-sm font-bold">Accentfärg<input name="accentColor" type="color" defaultValue={settings.accentColor} className="h-12 w-full rounded-xl border border-[#d7dfd7] p-1" /></label>
      </section>
      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6"><h2 className="text-xl font-bold">Sektioner</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{toggles.map(([name, label]) => <label key={name} className="flex items-center justify-between rounded-xl border border-[#e0e5dd] p-4 text-sm font-bold"><span>{label}</span><input name={name} type="checkbox" defaultChecked={settings[name]} className="h-5 w-5" /></label>)}</div></section>
      <section className="grid gap-4 rounded-[24px] border border-[#dfe6df] bg-white p-6 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">Logotyp URL<input name="logoUrl" defaultValue={settings.logoUrl} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-bold">Hero-bild URL<input name="heroImageUrl" defaultValue={settings.heroImageUrl} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-bold">Hero-video URL<input name="heroVideoUrl" defaultValue={settings.heroVideoUrl} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-bold">Egen domän<input name="customDomain" defaultValue={settings.customDomain} placeholder="booking.foretagen.se" className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
      </section>
      <button className="min-h-12 rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">Spara bokningssidans utseende</button>
    </form>
  </div>;
}
