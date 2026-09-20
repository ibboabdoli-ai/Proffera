import { SlidersHorizontal } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardActionFeedback } from "@/components/dashboard/dashboard-action-feedback";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";

import { BookingPageBuilder } from "./booking-page-builder";
import { ThemeContentEditor } from "./theme-content-editor";
import {
  isBookingThemeKey,
  withBookingThemeContentOverride,
  type BookingThemeContentOverride,
} from "@/lib/booking-theme-templates";
import { getSql } from "@/lib/db/server";
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
  removeVercelCustomDomain,
} from "@/lib/vercel-custom-domains";
import type { VercelCustomDomainState } from "@/lib/vercel-custom-domain-policy";

export const dynamic = "force-dynamic";

function appearanceUrl(input: { updated?: boolean; error?: string; domain?: VercelCustomDomainState; removed?: boolean }) {
  const query = new URLSearchParams();
  if (input.updated) query.set("updated", "1");
  if (input.error) query.set("error", input.error);
  if (input.domain) query.set("domain", input.domain);
  if (input.removed) query.set("domainRemoved", "1");
  const suffix = query.toString();
  return `/dashboard/installningar/utseende${suffix ? `?${suffix}` : ""}`;
}

async function syncSavedCustomDomain() {
  "use server";

  if (!(await hasWorkspaceFeature("custom_domain"))) redirect("/dashboard/installningar/funktioner");

  const settings = await getWorkspaceExperienceSettings();
  if (!settings.customDomain) redirect(appearanceUrl({ error: "domain" }));

  const status = await ensureVercelCustomDomain(settings.customDomain);
  await setWorkspaceCustomDomainConnectionStatus(settings.customDomain, status.state === "connected");
  redirect(appearanceUrl({ domain: status.state }));
}

async function disconnectSavedCustomDomain() {
  "use server";

  if (!(await hasWorkspaceFeature("custom_domain"))) redirect("/dashboard/installningar/funktioner");

  const settings = await getWorkspaceExperienceSettings();
  if (!settings.customDomain) redirect(appearanceUrl({ error: "domain" }));
  if (isPrimeViewHost(settings.customDomain)) redirect(appearanceUrl({ error: "domain_protected" }));

  const removal = await removeVercelCustomDomain(settings.customDomain);
  if (!removal.ok) redirect(appearanceUrl({ error: "domain_remove" }));

  await updateWorkspaceExperienceSettings({
    ...settings,
    customDomain: "",
    customDomainStatus: "disconnected",
  });
  redirect(appearanceUrl({ removed: true }));
}

async function saveThemeContent(formData: FormData) {
  "use server";

  if (!(await hasWorkspaceFeature("website_builder"))) redirect("/dashboard/installningar/funktioner");
  const themeKeyInput = String(formData.get("themeContentKey") ?? "");
  if (!isBookingThemeKey(themeKeyInput)) redirect(appearanceUrl({ error: "theme_content" }));

  const current = await getWorkspaceExperienceSettings();
  const reset = formData.get("resetThemeContent") === "1";
  const override: BookingThemeContentOverride | null = reset ? null : {
    heroTitleSv: String(formData.get("heroTitleSv") ?? "").trim(),
    heroTitleEn: String(formData.get("heroTitleEn") ?? "").trim(),
    heroSubtitleSv: String(formData.get("heroSubtitleSv") ?? "").trim(),
    heroSubtitleEn: String(formData.get("heroSubtitleEn") ?? "").trim(),
    heroDescriptionSv: String(formData.get("heroDescriptionSv") ?? "").trim(),
    heroDescriptionEn: String(formData.get("heroDescriptionEn") ?? "").trim(),
    ctaLabelSv: String(formData.get("ctaLabelSv") ?? "").trim(),
    ctaLabelEn: String(formData.get("ctaLabelEn") ?? "").trim(),
    faqTitleSv: String(formData.get("faqTitleSv") ?? "").trim(),
    faqTitleEn: String(formData.get("faqTitleEn") ?? "").trim(),
    faqBodySv: String(formData.get("faqBodySv") ?? "").trim(),
    faqBodyEn: String(formData.get("faqBodyEn") ?? "").trim(),
    heroImageUrl: String(formData.get("themeHeroImageUrl") ?? "").trim(),
  };

  await updateWorkspaceExperienceSettings({
    ...current,
    themeContentOverrides: withBookingThemeContentOverride(current.themeContentOverrides, themeKeyInput, override),
  });
  redirect(appearanceUrl({ updated: true }));
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

  if (canUseCustomDomain && formData.has("customDomain")) {
    const rawCustomDomain = String(formData.get("customDomain") ?? "").trim();
    customDomain = normalizeCustomDomainInput(rawCustomDomain);
    if (rawCustomDomain && !customDomain) redirect(appearanceUrl({ error: "domain" }));
  }

  const domainChanging = canUseCustomDomain && customDomain !== current.customDomain;
  if (domainChanging && (isPrimeViewHost(current.customDomain) || isPrimeViewHost(customDomain))) {
    redirect(appearanceUrl({ error: "domain_protected" }));
  }

  if (domainChanging && current.customDomain && !customDomain) {
    const removal = await removeVercelCustomDomain(current.customDomain);
    if (!removal.ok) redirect(appearanceUrl({ error: "domain_remove" }));
  }

  const requestedDefaultLanguage = formData.get("defaultLanguage") === "en" ? "en" as const : "sv" as const;
  const defaultLanguage = requestedDefaultLanguage === "en" && englishEnabled
    ? "en" as const
    : requestedDefaultLanguage === "sv" && swedishEnabled
      ? "sv" as const
      : englishEnabled
        ? "en" as const
        : "sv" as const;

  const nextSettings = {
    themeKey: String(formData.get("themeKey") ?? "clean"),
    primaryColor: String(formData.get("primaryColor") ?? "#0a2e63"),
    accentColor: String(formData.get("accentColor") ?? "#1469d8"),
    appearance: formData.get("appearance") === "dark" ? "dark" as const : "light" as const,
    defaultLanguage,
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
    logoUrl: formData.has("logoUrl") ? String(formData.get("logoUrl") ?? "") : current.logoUrl,
    heroImageUrl: formData.has("heroImageUrl") ? String(formData.get("heroImageUrl") ?? "") : current.heroImageUrl,
    heroVideoUrl: formData.has("heroVideoUrl") ? String(formData.get("heroVideoUrl") ?? "") : current.heroVideoUrl,
    customDomain,
    customDomainStatus: current.customDomainStatus,
    themeContentOverrides: current.themeContentOverrides,
  };

  try {
    await updateWorkspaceExperienceSettings(nextSettings);
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOM_DOMAIN_TAKEN") redirect(appearanceUrl({ error: "domain_taken" }));
    if (error instanceof Error && error.message === "INVALID_CUSTOM_DOMAIN") redirect(appearanceUrl({ error: "domain" }));
    throw error;
  }

  const domainNeedsProvisioning =
    canUseCustomDomain &&
    Boolean(customDomain) &&
    !isPrimeViewHost(customDomain) &&
    (domainChanging || current.customDomainStatus !== "connected");

  if (domainNeedsProvisioning) {
    const status = await ensureVercelCustomDomain(customDomain);

    if (!status.projectAttached) {
      await updateWorkspaceExperienceSettings({
        ...nextSettings,
        customDomain: current.customDomain,
        customDomainStatus: current.customDomainStatus,
      });
      redirect(appearanceUrl({ error: "domain_provision", domain: status.state }));
    }

    await setWorkspaceCustomDomainConnectionStatus(customDomain, status.state === "connected");

    const previousDomainNeedsCleanup =
      domainChanging &&
      Boolean(current.customDomain) &&
      current.customDomain !== customDomain &&
      !isPrimeViewHost(current.customDomain);

    if (previousDomainNeedsCleanup) {
      const cleanup = await removeVercelCustomDomain(current.customDomain);
      if (!cleanup.ok) {
        const compensation = await removeVercelCustomDomain(customDomain);
        if (!compensation.ok) console.error("Failed to compensate custom-domain replacement cleanup");
        await updateWorkspaceExperienceSettings({
          ...nextSettings,
          customDomain: current.customDomain,
          customDomainStatus: current.customDomainStatus,
        });
        redirect(appearanceUrl({ error: "domain_cleanup" }));
      }
    }

    redirect(appearanceUrl({ updated: true, domain: status.state }));
  }

  redirect(appearanceUrl({ updated: true }));
}

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
  searchParams?: Promise<{ updated?: string; error?: string; domain?: string; domainRemoved?: string }>;
}) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  const [settings, builderEnabled, customDomainEnabled] = await Promise.all([
    getWorkspaceExperienceSettings(),
    hasWorkspaceFeature("website_builder"),
    hasWorkspaceFeature("custom_domain"),
  ]);

  const sql = getSql();
  const bookingSlugRows = sql
    ? await sql`select public_booking_slug from workspaces where id = ${access.workspaceId}::uuid limit 1`
    : [];
  const publicBookingSlug = String(bookingSlugRows[0]?.public_booking_slug ?? "").trim();
  const publicBookingUrl = publicBookingSlug ? `/boka/${encodeURIComponent(publicBookingSlug)}` : "";

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
  const actionStatusMessage = params.updated === "1"
    ? "Designen och temainnehållet sparades och publicerades."
    : params.domainRemoved === "1"
      ? "Domänen kopplades från och togs bort från Profferas Vercel-projekt."
      : null;
  const actionErrorMessages: Record<string, string> = {
    language: "Minst ett språk måste vara aktivt.",
    theme_content: "Temainnehållet kunde inte sparas. Välj ett giltigt tema.",
    domain: "Ange bara ett giltigt domännamn, till exempel booking.foretagen.se.",
    domain_taken: "Domänen används redan av en annan arbetsyta.",
    domain_remove: "Domänen kunde inte kopplas från Vercel. Ingen säker bortkoppling genomfördes.",
    domain_cleanup: "Den gamla domänen kunde inte städas bort säkert. Domänbytet återställdes.",
    domain_provision: "Den nya domänen kunde inte läggas till säkert i Vercel. Den tidigare domänen behölls.",
    domain_protected: "Den här domänen är skyddad och kan inte flyttas eller kopplas från via självservice.",
  };
  const actionAlertMessage = params.error ? actionErrorMessages[params.error] ?? null : null;

  return (
    <div className="grid gap-5">
      <DashboardPageHeader
        eyebrow="Bokningssida / Booking page"
        title="Bygg din bokningssida"
        description="Välj en professionell mall, anpassa varumärket och bestäm vilka sektioner kunderna ska se. Förhandsvisningen reagerar direkt och samma verktyg används av alla arbetsytor."
        icon={SlidersHorizontal}
        actions={publicBookingUrl ? <a href={publicBookingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand-deep px-4 py-2.5 text-sm font-bold text-white">Visa publik sida</a> : null}
      />

      <DashboardActionFeedback statusMessage={actionStatusMessage} alertMessage={actionAlertMessage} />

      {!builderEnabled ? (
        <section className="rounded-card border border-[#efd58d] bg-[#fff7df] p-5">
          <p className="font-bold text-[#805d14]">Sidbyggaren är låst för nuvarande plan.</p>
          <p className="mt-2 text-sm text-[#805d14]">Starta en 14-dagars testperiod eller uppgradera planen. Dina inställningar behålls.</p>
          <a href="/dashboard/installningar/funktioner" className="mt-4 inline-flex rounded-control bg-brand-deep px-4 py-2 text-sm font-bold text-white">Visa funktioner</a>
        </section>
      ) : null}

      <BookingPageBuilder
        settings={settings}
        builderEnabled={builderEnabled}
        customDomainEnabled={customDomainEnabled}
        domainConnected={domainConnected}
        publicBookingUrl={publicBookingUrl}
        workspaceName={access.workspaceName}
        saveAction={saveAppearance}
      />

      {builderEnabled ? <ThemeContentEditor activeThemeKey={settings.themeKey} overrides={settings.themeContentOverrides} saveAction={saveThemeContent} /> : null}

      {customDomainEnabled && settings.customDomain && !bespokePrimeView ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6" data-domain-connection-status>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">Automatisk domänanslutning</p>
              <h2 className="mt-2 text-xl font-black text-ink">{settings.customDomain}</h2>
              {statusMessage ? <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{statusMessage}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={syncSavedCustomDomain}>
                <button className="min-h-11 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand">Kontrollera och anslut</button>
              </form>
              <form action={disconnectSavedCustomDomain}>
                <button className="min-h-11 rounded-xl border border-[#efc8c0] bg-surface px-4 py-2.5 text-sm font-bold text-danger">Koppla från domän</button>
              </form>
            </div>
          </div>

          {automationStatus?.verificationRecords.length ? (
            <div className="mt-5 rounded-card bg-[#fff7df] p-4 ring-1 ring-[#ead9ac]">
              <h3 className="font-bold text-[#805d14]">TXT för verifiering</h3>
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
            <div className="mt-5 rounded-card bg-surface-subtle p-4 ring-1 ring-line">
              <h3 className="font-bold text-ink">DNS som Vercel rekommenderar</h3>
              {automationStatus.recommendedCNAME.length ? <p className="mt-3 break-all text-sm"><strong>CNAME:</strong> {automationStatus.recommendedCNAME.join(", ")}</p> : null}
              {automationStatus.recommendedIPv4.length ? <p className="mt-2 break-all text-sm"><strong>A / IPv4:</strong> {automationStatus.recommendedIPv4.join(", ")}</p> : null}
              <p className="mt-3 text-xs leading-5 text-ink-muted">Använd värdena som visas av Vercel för just den här domänen. Proffera flyttar eller skriver aldrig över en domän som tillhör ett annat Vercel-projekt.</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
