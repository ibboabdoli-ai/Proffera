import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Building2, CheckCircle2, MapPin, Search, Store } from "lucide-react";

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
  const linkedProfileCity = linkedProfile?.city ?? "";
  const allowedSlugs = new Set(state.directoryServices.map((service) => service.slug));
  const activatableWorkspaceServices = state.workspaceServices.filter((service) => service.isActive);
  const activeMarketplaceServices = state.workspaceServices.filter(
    (service) => service.isActive && service.publicStatus === "published" && allowedSlugs.has(service.publicSlug) && service.serviceAreaConfirmed,
  );

  return (
    <div className="grid gap-6">
      <header className="rounded-[28px] bg-[#173e2b] p-7 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">{t.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black">{t.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">{t.lead}</p>
      </header>

      {status && statusCopy[status] ? (
        <section className={`rounded-2xl p-4 text-sm font-bold ${status === "service_ok" || status === "linked" ? "bg-[#eaf6ed] text-[#17452f]" : "bg-[#fff5f2] text-[#8f2f1b]"}`} role="status">
          <p>{statusCopy[status][locale]}</p>
          {status === "not_found" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="font-semibold">{t.addMissingCompany}</p>
              <Link
                href={withLang("/dashboard/marknadsplats/lagg-till-foretag", locale)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#d6b5ab] bg-white px-4 text-sm font-black text-[#8f2f1b]"
              >
                {t.addCompany}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {!linkedProfile ? (
        <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
          <div className="flex items-start gap-3">
            <Building2 className="mt-1 h-6 w-6 text-[#17452f]" />
            <div>
              <h2 className="text-xl font-black text-[#17201a]">{t.officialCompany}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667168]">{locale === "en" ? "We use the exact official organisation number. Company names are never matched approximately." : "Vi använder exakt officiellt organisationsnummer. Företagsnamn matchas aldrig ungefärligt."}</p>
            </div>
          </div>

          {state.pendingClaim ? (
            <div className="mt-5 rounded-2xl border border-[#e7d29c] bg-[#fff9e9] p-5">
              <p className="font-black text-[#76580d]">{t.pendingTitle}</p>
              <p className="mt-1 text-sm leading-6 text-[#6f654c]">{state.pendingClaim.companyName} · {state.pendingClaim.organizationNumber}</p>
              <p className="mt-2 text-sm leading-6 text-[#6f654c]">{t.pendingLead}</p>
              {state.pendingClaim.profileSlug ? (
                <Link href={claimHref(state.pendingClaim.profileSlug, locale)} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#d5bd7c] bg-white px-4 text-sm font-black text-[#76580d]">
                  {locale === "en" ? "Open verification" : "Öppna verifiering"}
                </Link>
              ) : null}
            </div>
          ) : (
            <form action={findOfficialCompanyAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="lang" value={locale} />
              <label className="grid gap-2 text-sm font-bold text-[#334139]">
                {t.organizationNumber}
                <input name="organizationNumber" required inputMode="numeric" autoComplete="off" placeholder={t.organizationPlaceholder} className="min-h-12 rounded-xl border border-[#cad8ce] bg-white px-4 text-base outline-none focus:ring-2 focus:ring-[#17452f]/20" />
              </label>
              <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-6 text-sm font-black text-white">
                <Search className="h-4 w-4" /> {t.findCompany}
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-[24px] border border-[#c9e6d0] bg-[#eef8f0] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-black text-[#17452f]"><BadgeCheck className="h-5 w-5" /> {t.linked}</p>
                <h2 className="mt-2 text-2xl font-black text-[#17201a]">{linkedProfile.companyName}</h2>
                <p className="mt-2 text-sm text-[#466352]">{linkedProfile.organizationNumber}{linkedProfile.city ? ` · ${linkedProfile.city}` : ""}</p>
              </div>
              {linkedProfile.slug ? (
                <Link href={locale === "en" ? `/en/companies/${encodeURIComponent(linkedProfile.slug)}` : `/foretag/listad/${encodeURIComponent(linkedProfile.slug)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#bcd8c3] bg-white px-4 text-sm font-black text-[#17452f]">
                  {locale === "en" ? "Official profile" : "Officiell profil"}
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
            <div className="flex items-start gap-3">
              <Store className="mt-1 h-6 w-6 text-[#17452f]" />
              <div>
                <h2 className="text-xl font-black text-[#17201a]">{t.servicesTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-[#667168]">{t.servicesLead}</p>
              </div>
            </div>

            {activatableWorkspaceServices.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-[#fff9e9] p-4 text-sm font-semibold leading-6 text-[#76580d]">
                <p>{t.noWorkspaceServices}</p>
                <Link href={withLang("/dashboard/installningar", locale)} className="mt-3 inline-flex font-black underline underline-offset-4">{t.manageServices}</Link>
              </div>
            ) : state.directoryServices.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#fff9e9] p-4 text-sm font-semibold leading-6 text-[#76580d]">{t.noDirectoryServices}</p>
            ) : (
              <form action={activateMarketplaceServiceAction} className="mt-6 grid gap-4 md:grid-cols-2">
                <input type="hidden" name="lang" value={locale} />
                <label className="grid gap-2 text-sm font-bold text-[#334139]">
                  {t.workspaceService}
                  <select name="serviceId" required className="min-h-12 rounded-xl border border-[#cad8ce] bg-white px-3 text-sm">
                    {activatableWorkspaceServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#334139]">
                  {t.marketplaceService}
                  <select name="directoryServiceSlug" required className="min-h-12 rounded-xl border border-[#cad8ce] bg-white px-3 text-sm">
                    {state.directoryServices.map((service) => <option key={service.slug} value={service.slug}>{service.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#334139]">
                  {t.action}
                  <select name="conversionMode" defaultValue="book" className="min-h-12 rounded-xl border border-[#cad8ce] bg-white px-3 text-sm">
                    <option value="book">{t.book}</option>
                    <option value="quote">{t.quote}</option>
                    <option value="book_or_quote">{t.both}</option>
                    <option value="contact">{t.contact}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#334139]">
                  {t.radius}
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667168]" />
                    <input name="radiusKm" type="number" min="1" max="300" step="0.1" defaultValue="25" required className="min-h-12 w-full rounded-xl border border-[#cad8ce] bg-white pl-10 pr-3 text-sm" />
                  </div>
                </label>
                <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-6 text-sm font-black text-white md:col-span-2">
                  <CheckCircle2 className="h-4 w-4" /> {t.activate}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6">
            <h2 className="text-xl font-black text-[#17201a]">{t.activeTitle}</h2>
            {activeMarketplaceServices.length === 0 ? (
              <p className="mt-3 text-sm text-[#667168]">{t.noneActive}</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {activeMarketplaceServices.map((service) => (
                  <article key={service.id} className="flex flex-col gap-3 rounded-2xl border border-[#dfe6df] bg-[#f8faf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-[#17201a]">{service.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[#667168]">{service.publicSlug} · {service.conversionMode} · {service.serviceAreaRadiusKm ?? "–"} km</p>
                    </div>
                    <Link href={locale === "en"
                      ? `/en/companies?service=${encodeURIComponent(service.publicSlug)}${linkedProfileCity ? `&location=${encodeURIComponent(linkedProfileCity)}` : ""}`
                      : `/foretag/listad?service=${encodeURIComponent(service.publicSlug)}${linkedProfileCity ? `&location=${encodeURIComponent(linkedProfileCity)}` : ""}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#cbd8ce] bg-white px-4 text-sm font-black text-[#17452f]">
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
