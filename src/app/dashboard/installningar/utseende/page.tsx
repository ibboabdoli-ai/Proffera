import { redirect } from "next/navigation";

import { isPrimeViewHost, normalizeCustomDomainInput } from "@/lib/public-site-domains";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasWorkspaceFeature } from "@/lib/workspace-entitlements";
import {
  getWorkspaceExperienceSettings,
  setWorkspaceCustomDomainConnectionStatus,
  updateWorkspaceExperienceSettings,
} from "@/lib/workspace-experience";
import {
  ensureVercelCustomDomain,
  getVercelCustomDomainStatus,
} from "@/lib/vercel-custom-domains";
import type { VercelCustomDomainState } from "@/lib/vercel-custom-domain-policy";

export const dynamic = "force-dynamic";

function appearanceUrl(input: { updated?: boolean; error?: string; domain?: VercelCustomDomainState }) {
  const query = new URLSearchParams();
  if (input.updated) query.set("updated", "1");
  if (input.error) query.set("error", input.error);
  if (input.domain) query.set("domain", input.domain);
  const suffix = query.toString();
  return `/dashboard/installningar/utseende${suffix ? `?${suffix}` : ""}`;
}

async function syncSavedCustomDomain() {
  "use server";

  if (!(await hasWorkspaceFeature("custom_domain"))) {
    redirect("/dashboard/installningar/funktioner");
  }

  const settings = await getWorkspaceExperienceSettings();
  if (!settings.customDomain) redirect(appearanceUrl({ error: "domain" }));

  const status = await ensureVercelCustomDomain(settings.customDomain);
  await setWorkspaceCustomDomainConnectionStatus(settings.customDomain, status.state === "connected");
  redirect(appearanceUrl({ domain: status.state }));
}

async function saveAppearance(formData: FormData) {
  "use server";

  const canUseBuilder = await hasWorkspaceFeature("website_builder");
  if (!canUseBuilder) redirect("/dashboard/installningar/funktioner");

  const swedishEnabled = formData.get("swedishEnabled") === "on";
  const englishEnabled = formData.get("englishEnabled") === "on";
  if (!swedishEnabled && !englishEnabled) redirect(appearanceUrl({ error: "language" }));

  const current = await getWorkspaceExperienceSettings();
  const canUseCustomDomain = await hasWorkspaceFeature("custom_domain");
  let customDomain = current.customDomain;

  if (canUseCustomDomain) {
    const rawCustomDomain = String(formData.get("customDomain") ?? "").trim();
    customDomain = normalizeCustomDomainInput(rawCustomDomain);
    if (rawCustomDomain && !customDomain) redirect(appearanceUrl({ error: "domain" }));
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
      customDomainStatus: current.customDomainStatus,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOM_DOMAIN_TAKEN") {
      redirect(appearanceUrl({ error: "domain_taken" }));
    }
    if (error instanceof Error && error.message === "INVALID_CUSTOM_DOMAIN") {
      redirect(appearanceUrl({ error: "domain" }));
    }
    throw error;
  }

  const domainNeedsProvisioning =
    canUseCustomDomain &&
    Boolean(customDomain) &&
    !isPrimeViewHost(customDomain) &&
    (customDomain !== current.customDomain || current.customDomainStatus !== "connected");

  if (domainNeedsProvisioning) {
    const status = await ensureVercelCustomDomain(customDomain);
    await setWorkspaceCustomDomainConnectionStatus(customDomain, status.state === "connected");
    redirect(appearanceUrl({ updated: true, domain: status.state }));
  }

  redirect(appearanceUrl({ updated: true }));
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

const domainMessages: Partial<Record<VercelCustomDomainState, string>> = {
  connected: "Domänen är verifierad och DNS är korrekt. Den är klar att använda.",
  verification: "Domänen är tillagd i Vercel men ägarskapet behöver verifieras. Lägg in TXT-posten som visas nedan och kontrollera igen.",
  dns: "Domänen är verifierad men DNS behöver justeras enligt Vercels rekommendationer nedan.",
  missing: "Domänen är sparad men har ännu inte lagts till i Vercel. Klicka på Kontrollera och anslut.",
  conflict: "Vercel rapporterar att domänen redan används av ett annat projekt. Proffera flyttar aldrig en domän automatiskt.",
  unconfigured: "Automatisk domänanslutning är ännu inte aktiverad på Proffera-servern. Den sparade domänen påverkas inte.",
  error: "Vercel kunde inte kontrollera domänen just nu. Försök igen senare.",
};

export default async function AppearanceSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string; domain?: string }>;
}) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  const [settings, builderEnabled, customDomainEnabled] = await Promise.all([
    getWorkspaceExperienceSettings(),
    hasWorkspaceFeature("website_builder"),
    hasWorkspaceFeature("custom_domain"),
  ]);
  const params = searchParams ? await searchParams : {};
  const bespokePrimeView = isPrimeViewHost(settings.customDomain);
  const automationStatus = customDomainEnabled && settings.customDomain && !bespokePrimeView
    ? await getVercelCustomDomainStatus(settings.customDomain)
    : null;
  const domainConnected = bespokePrimeView || (
    automationStatus?.automationConfigured
      ? automationStatus.state === "connected"
      : settings.customDomainStatus === "connected"
  );
  const redirectDomainState = params.domain && Object.prototype.hasOwnProperty.call(domainMessages, params.domain)
    ? (params.domain as VercelCustomDomainState)
    : null;
  const statusMessage = automationStatus
    ? domainMessages[automationStatus.state]
    : redirectDomainState
      ? domainMessages[redirectDomainState]
      : null;

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
                ? "Spara domänen. Proffera försöker sedan lägga till och verifiera den automatiskt i Vercel och visar exakt vad som saknas i DNS."
                : "Egen domän är låst för nuvarande plan. Befintlig inställning behålls men publiceras inte utan modulåtkomst."}
            </p>
            {!customDomainEnabled ? <a href="/dashboard/installningar/funktioner" className="text-sm font-bold text-[#17452f] underline underline-offset-4">Visa domänåtkomst</a> : null}
          </div>
        </section>

        <button className="min-h-12 rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">Spara inställningar</button>
      </form>

      {customDomainEnabled && settings.customDomain && !bespokePrimeView ? (
        <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#68736b]">Automatisk domänanslutning</p>
              <h2 className="mt-2 text-xl font-black text-[#17201a]">{settings.customDomain}</h2>
              {statusMessage ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6b63]">{statusMessage}</p> : null}
            </div>
            <form action={syncSavedCustomDomain}>
              <button className="min-h-11 rounded-xl border border-[#bfcdbf] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]">Kontrollera och anslut</button>
            </form>
          </div>

          {automationStatus?.verificationRecords.length ? (
            <div className="mt-5 rounded-2xl bg-[#fff9e9] p-4 ring-1 ring-[#ead9ac]">
              <h3 className="font-bold text-[#6f5512]">TXT för verifiering</h3>
              <div className="mt-3 grid gap-3">
                {automationStatus.verificationRecords.map((record, index) => (
                  <div key={`${record.type}-${record.domain}-${index}`} className="grid gap-1 text-sm">
                    <span><strong>Typ:</strong> {record.type}</span>
                    {record.domain ? <span className="break-all"><strong>Namn:</strong> {record.domain}</span> : null}
                    <span className="break-all font-mono text-xs"><strong>Värde:</strong> {record.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {automationStatus?.recommendedCNAME.length || automationStatus?.recommendedIPv4.length ? (
            <div className="mt-5 rounded-2xl bg-[#f7f9f6] p-4 ring-1 ring-[#dfe6df]">
              <h3 className="font-bold text-[#17201a]">DNS som Vercel rekommenderar</h3>
              {automationStatus.recommendedCNAME.length ? <p className="mt-3 break-all text-sm"><strong>CNAME:</strong> {automationStatus.recommendedCNAME.join(", ")}</p> : null}
              {automationStatus.recommendedIPv4.length ? <p className="mt-2 break-all text-sm"><strong>A / IPv4:</strong> {automationStatus.recommendedIPv4.join(", ")}</p> : null}
              <p className="mt-3 text-xs leading-5 text-[#667168]">Använd värdena som visas av Vercel för just den här domänen. Proffera flyttar eller skriver aldrig över en domän som tillhör ett annat Vercel-projekt.</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
