import { redirect } from "next/navigation";

import { isPrimeViewHost, normalizeCustomDomainInput } from "@/lib/public-site-domains";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasWorkspaceFeature } from "@/lib/workspace-entitlements";
import { getWorkspaceExperienceSettings, updateWorkspaceExperienceSettings } from "@/lib/workspace-experience";

export const dynamic = "force-dynamic";

async function saveAppearance(formData: FormData) {
  "use server";

  const canUseBuilder = await hasWorkspaceFeature("website_builder");
  if (!canUseBuilder) redirect("/dashboard/installningar/funktioner");

  const swedishEnabled = formData.get("swedishEnabled") === "on";
  const englishEnabled = formData.get("englishEnabled") === "on";
  if (!swedishEnabled && !englishEnabled) redirect("/dashboard/installningar/utseende?error=language");

  const canUseCustomDomain = await hasWorkspaceFeature("custom_domain");
  let customDomain = "";

  if (canUseCustomDomain) {
    const rawCustomDomain = String(formData.get("customDomain") ?? "").trim();
    customDomain = normalizeCustomDomainInput(rawCustomDomain);
    if (rawCustomDomain && !customDomain) redirect("/dashboard/installningar/utseende?error=domain");
  } else {
    const current = await getWorkspaceExperienceSettings();
    customDomain = current.customDomain;
  }

  try {
    await updateWorkspaceExperienceSettings({
      themeKey: String(formData.get("themeKey") ?? "clean"),
      primaryColor: String(formData.get("primaryColor") ?? "#17452f"),
      accentColor: String(formData.get("accentColor") ?? "#d9b44a"),
      appearance: formData.get("appearance") === "dark" ? "dark" : "light",
      defaultLanguage: formData.get("defaultLanguage") === "en" ? "en" : "sv",
      swedishEnabled,
      englishEnabled,
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
      customDomain,
      customDomainStatus: "disconnected",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOM_DOMAIN_TAKEN") {
      redirect("/dashboard/installningar/utseende?error=domain_taken");
    }
    if (error instanceof Error && error.message === "INVALID_CUSTOM_DOMAIN") {
      redirect("/dashboard/installningar/utseende?error=domain");
    }
    throw error;
  }

  redirect("/dashboard/installningar/utseende?updated=1");
}

const toggles = [
  ["heroEnabled", "Hero"],
  ["servicesEnabled", "Tjänster"],
  ["staffEnabled", "Medarbetare"],
  ["reviewsEnabled", "Omdömen"],
  ["galleryEnabled", "Galleri"],
  ["contactEnabled", "Kontakt"],
  ["faqEnabled", "FAQ"],
  ["chatbotEnabled", "AI-chatt på bokningssidan"],
] as const;

export default async function AppearanceSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string }>;
}) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  const [settings, builderEnabled, customDomainEnabled] = await Promise.all([
    getWorkspaceExperienceSettings(),
    hasWorkspaceFeature("website_builder"),
    hasWorkspaceFeature("custom_domain"),
  ]);
  const params = searchParams ? await searchParams : {};
  const domainConnected = settings.customDomainStatus === "connected" || isPrimeViewHost(settings.customDomain);

  return (
    <div className="grid gap-6">
      <header className="rounded-[28px] bg-[#173e2b] p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Bokningssida / Booking page</p>
        <h1 className="mt-2 text-3xl font-bold">Tema, språk och visuellt innehåll</h1>
        <p className="mt-3 text-sm leading-7 text-white/80">Alla arbetsytor använder samma självserviceverktyg. Planen avgör vilka delar som kan publiceras.</p>
      </header>

      {params.updated === "1" ? <p className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">Inställningarna sparades.</p> : null}
      {params.error === "language" ? <p className="rounded-xl bg-[#fff3ef] p-4 text-sm font-bold text-[#8f2f1b]">Minst ett språk måste vara aktivt.</p> : null}
      {params.error === "domain" ? <p className="rounded-xl bg-[#fff3ef] p-4 text-sm font-bold text-[#8f2f1b]">Ange bara ett giltigt domännamn, till exempel booking.foretagen.se.</p> : null}
      {params.error === "domain_taken" ? <p className="rounded-xl bg-[#fff3ef] p-4 text-sm font-bold text-[#8f2f1b]">Domänen används redan av en annan arbetsyta.</p> : null}

      {!builderEnabled ? (
        <section className="rounded-2xl border border-[#ead9ac] bg-[#fff9e9] p-5">
          <p className="font-bold text-[#6f5512]">Sidbyggaren är låst för nuvarande plan.</p>
          <p className="mt-2 text-sm text-[#765f28]">Starta en 14-dagars testperiod eller uppgradera planen. Dina inställningar behålls.</p>
          <a href="/dashboard/installningar/funktioner" className="mt-4 inline-flex rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white">Visa funktioner</a>
        </section>
      ) : null}

      <form action={saveAppearance} className={`grid gap-6 ${builderEnabled ? "" : "pointer-events-none opacity-55"}`}>
        <section className="grid gap-4 rounded-[24px] border border-[#dfe6df] bg-white p-6 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Tema<select name="themeKey" defaultValue={settings.themeKey} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal"><option value="clean">Clean</option><option value="salon">Salon</option><option value="premium">Premium</option><option value="modern">Modern</option><option value="minimal">Minimal</option></select></label>
          <label className="grid gap-2 text-sm font-bold">Läge / Appearance<select name="appearance" defaultValue={settings.appearance} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal"><option value="light">Ljust / Light</option><option value="dark">Mörkt / Dark</option></select></label>
          <label className="grid gap-2 text-sm font-bold">Primär färg<input name="primaryColor" type="color" defaultValue={settings.primaryColor} className="h-12 w-full rounded-xl border border-[#d7dfd7] p-1" /></label>
          <label className="grid gap-2 text-sm font-bold">Accentfärg<input name="accentColor" type="color" defaultValue={settings.accentColor} className="h-12 w-full rounded-xl border border-[#d7dfd7] p-1" /></label>
        </section>

        <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
          <h2 className="text-xl font-bold">Språk / Languages</h2>
          <p className="mt-2 text-sm text-[#5f6b63]">Kunden ser en språkväljare när båda språken är aktiva.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-xl border border-[#e0e5dd] p-4 text-sm font-bold"><span>Svenska</span><input name="swedishEnabled" type="checkbox" defaultChecked={settings.swedishEnabled} className="h-5 w-5" /></label>
            <label className="flex items-center justify-between rounded-xl border border-[#e0e5dd] p-4 text-sm font-bold"><span>English</span><input name="englishEnabled" type="checkbox" defaultChecked={settings.englishEnabled} className="h-5 w-5" /></label>
            <label className="grid gap-2 rounded-xl border border-[#e0e5dd] p-4 text-sm font-bold">Standardspråk<select name="defaultLanguage" defaultValue={settings.defaultLanguage} className="rounded-lg border border-[#d7dfd7] px-3 py-2 font-normal"><option value="sv">Svenska</option><option value="en">English</option></select></label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
          <h2 className="text-xl font-bold">Sektioner</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {toggles.map(([name, label]) => <label key={name} className="flex items-center justify-between rounded-xl border border-[#e0e5dd] p-4 text-sm font-bold"><span>{label}</span><input name={name} type="checkbox" defaultChecked={settings[name]} className="h-5 w-5" /></label>)}
          </div>
        </section>

        <section className="grid gap-4 rounded-[24px] border border-[#dfe6df] bg-white p-6 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">Logotyp URL<input name="logoUrl" defaultValue={settings.logoUrl} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
          <label className="grid gap-2 text-sm font-bold">Hero-bild URL<input name="heroImageUrl" defaultValue={settings.heroImageUrl} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
          <label className="grid gap-2 text-sm font-bold">Hero-video URL<input name="heroVideoUrl" defaultValue={settings.heroVideoUrl} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold">Egen domän</span>
              {settings.customDomain ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${domainConnected ? "bg-[#eaf6ed] text-[#17452f]" : "bg-[#fff7e5] text-[#805d14]"}`}>
                  {domainConnected ? "Ansluten" : "Väntar på anslutning"}
                </span>
              ) : null}
            </div>
            <input
              name="customDomain"
              defaultValue={settings.customDomain}
              placeholder="booking.foretagen.se"
              disabled={!customDomainEnabled}
              className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal disabled:cursor-not-allowed disabled:bg-[#f2f4f1] disabled:text-[#7a857d]"
            />
            <p className="text-xs leading-5 text-[#667168]">
              {customDomainEnabled
                ? "Spara endast domännamnet. När DNS pekar mot Proffera markeras domänen som ansluten automatiskt vid första riktiga besöket."
                : "Egen domän är låst för nuvarande plan. Befintlig inställning behålls men publiceras inte utan modulåtkomst."}
            </p>
            {!customDomainEnabled ? <a href="/dashboard/installningar/funktioner" className="text-sm font-bold text-[#17452f] underline underline-offset-4">Visa domänåtkomst</a> : null}
          </div>
        </section>

        <button className="min-h-12 rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">Spara inställningar</button>
      </form>
    </div>
  );
}
