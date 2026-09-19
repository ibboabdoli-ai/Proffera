import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Building2, CheckCircle2, MapPin, Search, Store } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";

import {
  activateProviderMarketplaceService,
  findProviderProfileByOrganizationNumber,
  getProviderActivationState,
} from "@/lib/company-directory-provider-activation";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

const copy = {
  sv: {
    eyebrow: "Marknadsplats",
    title: "Aktivera företaget på Proffera",
    lead: "Koppla arbetsytan till rätt officiell företagsprofil och välj vilka tjänster kunder ska kunna boka eller fråga om.",
    officialCompany: "Officiellt företag",
    organizationNumber: "Organisationsnummer",
    organizationPlaceholder: "556123-4567",
    findCompany: "Hitta mitt företag",
    pendingTitle: "Verifiering pågår",
    pendingLead: "Företagsmejlen eller den manuella granskningen måste bli klar innan tjänster kan publiceras på marknadsplatsen.",
    linked: "Kopplat och verifierat",
    servicesTitle: "Publicera en tjänst",
    servicesLead: "Välj en befintlig tjänst, vad den motsvarar i Profferas sök och hur kunden ska kunna agera.",
    workspaceService: "Din tjänst",
    marketplaceService: "Tjänst i Proffera",
    action: "Kundens primära väg",
    radius: "Serviceområde, radie i km",
    activate: "Publicera på marknadsplatsen",
    activeTitle: "Aktiva marknadsplatstjänster",
    noneActive: "Ingen tjänst är publicerad på marknadsplatsen ännu.",
    searchTest: "Testa i sök",
    book: "Boka tid",
    quote: "Begär offert",
    both: "Boka eller offert",
    contact: "Kontakta",
    noDirectoryServices: "Den officiella profilen saknar ännu en publicerbar tjänstekoppling. Proffera behöver komplettera tjänsteklassningen innan aktivering.",
    noWorkspaceServices: "Du har ingen aktiv tjänst att publicera. Lägg till eller aktivera en tjänst i Inställningar först.",
    manageServices: "Öppna Inställningar",
    addMissingCompany: "Företaget saknas? Kontrollera och lägg till det via officiella källor.",
    addCompany: "Lägg till företag",
  },
  en: {
    eyebrow: "Marketplace",
    title: "Activate your business on Proffera",
    lead: "Connect the workspace to the correct official business profile and choose which services customers can book or enquire about.",
    officialCompany: "Official business",
    organizationNumber: "Organisation number",
    organizationPlaceholder: "556123-4567",
    findCompany: "Find my business",
    pendingTitle: "Verification in progress",
    pendingLead: "Business email verification or manual review must be completed before services can be published in the marketplace.",
    linked: "Connected and verified",
    servicesTitle: "Publish a service",
    servicesLead: "Choose an existing service, its Proffera search classification and how customers should act.",
    workspaceService: "Your service",
    marketplaceService: "Proffera service",
    action: "Primary customer action",
    radius: "Service area radius, km",
    activate: "Publish to marketplace",
    activeTitle: "Active marketplace services",
    noneActive: "No service has been published in the marketplace yet.",
    searchTest: "Test in search",
    book: "Book appointment",
    quote: "Request quote",
    both: "Book or quote",
    contact: "Contact",
    noDirectoryServices: "The official profile does not yet have an eligible service mapping. Proffera must complete the service classification before activation.",
    noWorkspaceServices: "You have no active service to publish. Add or activate a service in Settings first.",
    manageServices: "Open Settings",
    addMissingCompany: "Business missing? Check and add it through official sources.",
    addCompany: "Add business",
  },
} as const;

const statusCopy: Record<string, Record<Locale, string>> = {
  invalid_org: { sv: "Kontrollera organisationsnumret. Det ska innehålla 10 siffror.", en: "Check the organisation number. It must contain 10 digits." },
  not_found: { sv: "Företaget finns inte i Profferas officiella register ännu.", en: "The business is not yet available in Proffera's official directory." },
  not_ready: { sv: "Företaget finns i registret men är inte säkert publicerbart ännu. Ingen koppling gjordes.", en: "The business exists in the directory but is not safely publishable yet. Nothing was connected." },
  claimed: { sv: "Företaget är redan kopplat till en annan Proffera-arbetsyta.", en: "The business is already connected to another Proffera workspace." },
  busy: { sv: "Ett annat verifieringsärende pågår för företaget. Försök igen senare.", en: "Another verification is already in progress for this business." },
  linked: { sv: "Företaget är redan kopplat till den här arbetsytan.", en: "The business is already connected to this workspace." },
  service_ok: { sv: "Tjänsten är publicerad på marknadsplatsen.", en: "The service is published in the marketplace." },
  service_error: { sv: "Tjänsten kunde inte aktiveras. Kontrollera tjänst, kundväg och serviceområde.", en: "The service could not be activated. Check the service, customer action and service area." },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function withLang(path: string, locale: Locale, status?: string) {
  const params = new URLSearchParams();
  if (locale === "en") params.set("lang", "en");
  if (status) params.set("status", status);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

function claimHref(slug: string, locale: Locale) {
  return locale === "en"
    ? `/en/companies/claim/${encodeURIComponent(slug)}`
    : `/foretag/claim/${encodeURIComponent(slug)}`;
}

async function findOfficialCompanyAction(formData: FormData) {
  "use server";
  const locale: Locale = formData.get("lang") === "en" ? "en" : "sv";
  let target = withLang("/dashboard/marknadsplats", locale, "not_found");
  try {
    const result = await findProviderProfileByOrganizationNumber(formData.get("organizationNumber"));
    if (result.status === "available") {
      target = claimHref(result.profileSlug, locale);
    } else {
      target = withLang("/dashboard/marknadsplats", locale, result.status);
    }
  } catch (error) {
    target = withLang(
      "/dashboard/marknadsplats",
      locale,
      error instanceof Error && error.message === "organization_number" ? "invalid_org" : "not_found",
    );
  }
  redirect(target);
}

async function activateMarketplaceServiceAction(formData: FormData) {
  "use server";
  const locale: Locale = formData.get("lang") === "en" ? "en" : "sv";
  let status = "service_ok";
  try {
    await activateProviderMarketplaceService({
      serviceId: String(formData.get("serviceId") ?? ""),
      directoryServiceSlug: String(formData.get("directoryServiceSlug") ?? ""),
      conversionMode: String(formData.get("conversionMode") ?? ""),
      radiusKm: formData.get("radiusKm"),
    });
  } catch {
    status = "service_error";
  }
  redirect(withLang("/dashboard/marknadsplats", locale, status));
}

export default async function MarketplaceActivationPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[]; status?: string | string[] }>;
}) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const params = searchParams ? await searchParams : undefined;
  const locale: Locale = first(params?.lang) === "en" ? "en" : "sv";
  const t = copy[locale];
  const status = first(params?.status) ?? "";
  const state = await getProviderActivationState();
  const linkedProfile = state.linkedProfile;
  const allowedSlugs = new Set(state.directoryServices.map((service) => service.slug));
  const activatableWorkspaceServices = state.workspaceServices.filter((service) => service.isActive);
  const activeMarketplaceServices = state.workspaceServices.filter(
    (service) => service.isActive
      && service.publicStatus === "published"
      && allowedSlugs.has(service.primaryDirectoryServiceSlug || service.publicSlug)
      && service.serviceAreaConfirmed,
  );

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.lead}
        icon={Store}
      />

      {status && statusCopy[status] ? (
        <section className={`rounded-card border p-4 text-sm font-bold ${status === "service_ok" || status === "linked" ? "border-[#cfe8d6] bg-[#eaf8f2] text-[#087754]" : "border-[#f4c7ba] bg-[#fff5f2] text-danger"}`} role="status">
          <p>{statusCopy[status][locale]}</p>
          {status === "not_found" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="font-semibold">{t.addMissingCompany}</p>
              <Link
                href={withLang("/dashboard/marknadsplats/lagg-till-foretag", locale)}
                className="inline-flex min-h-10 items-center justify-center rounded-control border border-[#efc8c0] bg-surface px-4 text-sm font-bold text-danger"
              >
                {t.addCompany}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {!linkedProfile ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <Building2 className="mt-1 h-6 w-6 text-brand" />
            <div>
              <h2 className="text-xl font-black text-ink">{t.officialCompany}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{locale === "en" ? "We use the exact official organisation number. Company names are never matched approximately." : "Vi använder exakt officiellt organisationsnummer. Företagsnamn matchas aldrig ungefärligt."}</p>
            </div>
          </div>

          {state.pendingClaim ? (
            <div className="mt-5 rounded-2xl border border-[#e7d29c] bg-[#fff9e9] p-5">
              <p className="font-black text-[#805d14]">{t.pendingTitle}</p>
              <p className="mt-1 text-sm leading-6 text-[#805d14]">{[state.pendingClaim.companyName, state.pendingClaim.organizationNumber].filter(Boolean).join(" · ")}</p>
              <p className="mt-2 text-sm leading-6 text-[#805d14]">{t.pendingLead}</p>
              {state.pendingClaim.profileSlug ? (
                <Link href={claimHref(state.pendingClaim.profileSlug, locale)} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#efd58d] bg-surface px-4 text-sm font-bold text-[#805d14]">
                  {locale === "en" ? "Open verification" : "Öppna verifiering"}
                </Link>
              ) : null}
            </div>
          ) : (
            <form action={findOfficialCompanyAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="lang" value={locale} />
              <label className="grid gap-2 text-sm font-bold text-ink">
                {t.organizationNumber}
                <input name="organizationNumber" required inputMode="numeric" autoComplete="off" placeholder={t.organizationPlaceholder} className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:ring-2 focus:ring-brand/20" />
              </label>
              <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand-deep px-6 text-sm font-black text-white">
                <Search className="h-4 w-4" /> {t.findCompany}
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-5 shadow-card sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-black text-brand"><BadgeCheck className="h-5 w-5" /> {t.linked}</p>
                <h2 className="mt-2 text-2xl font-black text-ink">{linkedProfile.companyName}</h2>
                <p className="mt-2 text-sm text-ink-muted">{[linkedProfile.organizationNumber, linkedProfile.city].filter(Boolean).join(" · ")}</p>
              </div>
              {linkedProfile.slug ? (
                <Link href={locale === "en" ? `/en/companies/${encodeURIComponent(linkedProfile.slug)}` : `/foretag/listad/${encodeURIComponent(linkedProfile.slug)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cfe8d6] bg-surface px-4 text-sm font-bold text-[#087754]">
                  {locale === "en" ? "Official profile" : "Officiell profil"}
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
              <Store className="mt-1 h-6 w-6 text-brand" />
              <div>
                <h2 className="text-xl font-black text-ink">{t.servicesTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{t.servicesLead}</p>
              </div>
            </div>

            {activatableWorkspaceServices.length === 0 ? (
              <div className="mt-5 rounded-card bg-[#fff7df] p-4 text-sm font-semibold leading-6 text-[#805d14]">
                <p>{t.noWorkspaceServices}</p>
                <Link href={withLang("/dashboard/installningar", locale)} className="mt-3 inline-flex font-black underline underline-offset-4">{t.manageServices}</Link>
              </div>
            ) : state.directoryServices.length === 0 ? (
              <p className="mt-5 rounded-card bg-[#fff7df] p-4 text-sm font-semibold leading-6 text-[#805d14]">{t.noDirectoryServices}</p>
            ) : (
              <form action={activateMarketplaceServiceAction} className="mt-6 grid gap-4 md:grid-cols-2">
                <input type="hidden" name="lang" value={locale} />
                <label className="grid gap-2 text-sm font-bold text-ink">
                  {t.workspaceService}
                  <select name="serviceId" required className="min-h-12 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm">
                    {activatableWorkspaceServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  {t.marketplaceService}
                  <select name="directoryServiceSlug" required className="min-h-12 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm">
                    {state.directoryServices.map((service) => <option key={service.slug} value={service.slug}>{service.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  {t.action}
                  <select name="conversionMode" defaultValue="book" className="min-h-12 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm">
                    <option value="book">{t.book}</option>
                    <option value="quote">{t.quote}</option>
                    <option value="book_or_quote">{t.both}</option>
                    <option value="contact">{t.contact}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  {t.radius}
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input name="radiusKm" type="number" min="1" max="300" step="0.1" defaultValue="25" required className="min-h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-base sm:text-sm" />
                  </div>
                </label>
                <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand-deep px-6 text-sm font-black text-white md:col-span-2">
                  <CheckCircle2 className="h-4 w-4" /> {t.activate}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-xl font-black text-ink">{t.activeTitle}</h2>
            {activeMarketplaceServices.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">{t.noneActive}</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {activeMarketplaceServices.map((service) => (
                  <article key={service.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-ink">{service.name}</p>
                      <p className="mt-1 text-xs font-semibold text-ink-muted">{service.publicSlug} · {service.conversionMode} · {service.serviceAreaRadiusKm ?? "–"} km</p>
                    </div>
                    <Link href={locale === "en"
                      ? `/en/companies?service=${encodeURIComponent(service.publicSlug)}`
                      : `/foretag/listad?service=${encodeURIComponent(service.publicSlug)}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-bold text-brand-deep">
                      {t.searchTest}
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
