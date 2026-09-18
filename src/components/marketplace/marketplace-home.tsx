import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Hammer,
  Leaf,
  MapPin,
  Paintbrush,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";

import {
  directoryPaths,
  directoryServiceLabel,
} from "@/components/company-directory/public-directory-copy";
import { PublicDirectorySearchForm } from "@/components/company-directory/public-directory-search-form";
import {
  MarketplaceCompanyCover,
  MarketplaceCompanyLogo,
} from "@/components/marketplace/marketplace-company-media";
import {
  getCachedMarketplaceHomeCompanies,
  getCachedPublishedDirectoryLocationSuggestions,
} from "@/lib/public-read-cache";
import type { PublicLocale } from "@/lib/public-locale";

import styles from "./marketplace-home.module.css";

type MarketplaceHomeCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  trust: string[];
  categoriesTitle: string;
  categoriesLead: string;
  categories: Array<{ label: string; query: string }>;
  allServices: string;
  companiesEyebrow: string;
  companiesTitle: string;
  companiesLead: string;
  allCompanies: string;
  verified: string;
  illustration: string;
  profferaReviews: string;
  viewProfile: string;
  google: string;
  howTitle: string;
  howLead: string;
  steps: Array<{ title: string; text: string }>;
  businessEyebrow: string;
  businessTitle: string;
  businessLead: string;
  businessCta: string;
  loginCta: string;
  workspaceLabel: string;
  workspaceItems: string[];
  sourcesEyebrow: string;
  sourcesTitle: string;
  sourcesLead: string;
  sourceOwner: string;
  sourceReviews: string;
};

const copy: Record<PublicLocale, MarketplaceHomeCopy> = {
  sv: {
    eyebrow: "Lokala företag. Verifierade uppgifter.",
    title: "Vad behöver du hjälp med?",
    lead: "Hitta företag, boka tid eller få offerter – gratis.",
    trust: ["Gratis att söka", "Företagsuppgifter verifierade", "Boka tid · Begär offert · Se företag"],
    categoriesTitle: "Populära tjänster",
    categoriesLead: "Välj en tjänst eller skriv själv vad du behöver hjälp med.",
    categories: [
      { label: "Elektriker", query: "elinstallation" },
      { label: "VVS & rörmokare", query: "vvs" },
      { label: "Städning", query: "lokalvard" },
      { label: "Flytt & transport", query: "flytthjalp" },
      { label: "Målare", query: "malning" },
      { label: "Snickare", query: "snickeri" },
      { label: "Trädgård", query: "tradgardshjalp" },
    ],
    allServices: "Se alla tjänster",
    companiesEyebrow: "Riktiga företagsprofiler",
    companiesTitle: "Företag att upptäcka",
    companiesLead: "Publicerade företag med verifierade grunduppgifter, riktig profilmedia där den finns och tydliga fallbacks där den saknas.",
    allCompanies: "Visa alla företag",
    verified: "Verifierade uppgifter",
    illustration: "Illustrationsbild",
    profferaReviews: "verifierade Proffera-omdömen",
    viewProfile: "Visa profil",
    google: "Google",
    howTitle: "Så fungerar Proffera",
    howLead: "Tre enkla steg från sökning till rätt företag.",
    steps: [
      { title: "Sök", text: "Skriv vad du behöver hjälp med och var jobbet ska utföras." },
      { title: "Jämför", text: "Se relevanta företag, tjänster och tillgängliga kundvägar." },
      { title: "Välj", text: "Boka tid, begär offert eller öppna företagets profil." },
    ],
    businessEyebrow: "För företag",
    businessTitle: "Vill du få fler kunder via Proffera?",
    businessLead: "Skapa din arbetsyta och hantera bokningar, offerter, kunder och jobb på samma ställe.",
    businessCta: "För företag",
    loginCta: "Logga in",
    workspaceLabel: "Proffera arbetsyta",
    workspaceItems: ["Bokningar", "Offerter", "Kunder", "Jobb"],
    sourcesEyebrow: "Transparens först",
    sourcesTitle: "Företagsinformation från flera tydliga källor",
    sourcesLead: "Officiella registeruppgifter kombineras med företagets egna publicerade uppgifter och Profferas verifierade marknadsplatsdata.",
    sourceOwner: "Företagets egna uppgifter",
    sourceReviews: "Verifierade Proffera-omdömen",
  },
  en: {
    eyebrow: "Local businesses. Verified details.",
    title: "What do you need help with?",
    lead: "Find businesses, book an appointment or request quotes – free.",
    trust: ["Free to search", "Verified company details", "Book appointment · Request quote · View business"],
    categoriesTitle: "Popular services",
    categoriesLead: "Choose a service or type what you need help with.",
    categories: [
      { label: "Electrician", query: "elinstallation" },
      { label: "Plumber", query: "vvs" },
      { label: "Cleaning", query: "lokalvard" },
      { label: "Moving & transport", query: "flytthjalp" },
      { label: "Painter", query: "malning" },
      { label: "Carpenter", query: "snickeri" },
      { label: "Gardening", query: "tradgardshjalp" },
    ],
    allServices: "View all services",
    companiesEyebrow: "Real business profiles",
    companiesTitle: "Businesses to discover",
    companiesLead: "Published businesses with verified core details, real profile media where available and clear fallbacks where it is not.",
    allCompanies: "View all businesses",
    verified: "Verified details",
    illustration: "Illustration",
    profferaReviews: "verified Proffera reviews",
    viewProfile: "View profile",
    google: "Google",
    howTitle: "How Proffera works",
    howLead: "Three simple steps from search to the right business.",
    steps: [
      { title: "Search", text: "Enter what you need help with and where the work should be done." },
      { title: "Compare", text: "See relevant businesses, services and available customer actions." },
      { title: "Choose", text: "Book an appointment, request a quote or open the business profile." },
    ],
    businessEyebrow: "For businesses",
    businessTitle: "Want to win more customers through Proffera?",
    businessLead: "Create your workspace and manage bookings, quotes, customers and jobs in one place.",
    businessCta: "For businesses",
    loginCta: "Log in",
    workspaceLabel: "Proffera workspace",
    workspaceItems: ["Bookings", "Quotes", "Customers", "Jobs"],
    sourcesEyebrow: "Transparency first",
    sourcesTitle: "Business information from clearly identified sources",
    sourcesLead: "Official register data is combined with businesses' own published information and Proffera's verified marketplace data.",
    sourceOwner: "Business-provided information",
    sourceReviews: "Verified Proffera reviews",
  },
};

const categoryIcons = [Zap, Wrench, Sparkles, Truck, Paintbrush, Hammer, Leaf] as const;
const stepIcons = [Search, Store, CheckCircle2] as const;

function profileHref(
  result: Awaited<ReturnType<typeof getCachedMarketplaceHomeCompanies>>["results"][number],
  locale: PublicLocale,
) {
  if (result.profile.workspaceSlug) {
    const href = `/foretag/${encodeURIComponent(result.profile.workspaceSlug)}`;
    return locale === "en" ? `${href}?lang=en` : href;
  }
  return `${directoryPaths[locale].search}/${encodeURIComponent(result.slug)}`;
}

function googleSearchHref(companyName: string, location: string) {
  const query = [companyName, location].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export async function MarketplaceHome({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const paths = directoryPaths[locale];
  const businessHref = locale === "en" ? "/en/for-business" : "/for-foretag";
  const loginHref = locale === "en" ? "/logga-in?lang=en" : "/logga-in?lang=sv";

  const [locationSuggestions, companies] = await Promise.all([
    getCachedPublishedDirectoryLocationSuggestions(24),
    getCachedMarketplaceHomeCompanies(4),
  ]);
  const serviceSuggestions = t.categories.map((category) => category.label);
  const featuredResults = companies.results.slice(0, 4);
  const heroResult = featuredResults.find((result) => {
    const media = result.profile.media;
    return Boolean(media && media.role !== "logo" && media.role !== "illustration");
  }) ?? featuredResults[0] ?? null;
  const heroMedia = heroResult?.profile.media && heroResult.profile.media.role !== "logo"
    ? heroResult.profile.media
    : null;

  return (
    <div className="overflow-hidden bg-canvas text-ink">
      <section className="border-b border-line bg-brand-tint">
        <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-10 lg:px-8 lg:py-14">
          <div className={`flex flex-col justify-center ${styles.heroCopy}`}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{t.eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-black leading-[1.02] tracking-[-0.045em] text-ink sm:text-5xl lg:text-6xl">{t.title}</h1>
            <p className="mt-4 max-w-2xl text-pretty text-lg leading-8 text-muted sm:text-xl">{t.lead}</p>

            <div className="mt-7 max-w-4xl">
              <PublicDirectorySearchForm
                locale={locale}
                service=""
                location=""
                serviceSuggestions={serviceSuggestions}
                locationSuggestions={locationSuggestions.slice(0, 12)}
                tone="light"
                layout="hero"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-body">
              {t.trust.map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className={`group relative hidden min-h-[360px] overflow-hidden rounded-panel border border-line bg-surface shadow-card lg:block ${styles.heroVisual}`}>
            <MarketplaceCompanyCover
              name={heroResult?.companyName ?? "Proffera"}
              url={heroMedia?.url}
              illustration={heroMedia?.role === "illustration"}
            />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/55 p-4 text-white backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">
                {heroResult ? (locale === "en" ? "Published business profile" : "Publicerad företagsprofil") : "Proffera"}
              </p>
              <p className="mt-1 text-xl font-black">{heroResult?.companyName ?? (locale === "en" ? "Find local professionals" : "Hitta lokala proffs")}</p>
              {heroResult ? (
                <p className="mt-1 text-sm text-white/80">
                  {heroResult.city || heroResult.municipality || (locale === "en" ? "Sweden" : "Sverige")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section id="populara-tjanster" className={`mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 ${styles.sectionReveal}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{t.categoriesTitle}</h2>
            <p className="mt-2 text-base leading-7 text-muted">{t.categoriesLead}</p>
          </div>
          <Link href={paths.search} className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-brand hover:underline">
            {t.allServices}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-7">
          {t.categories.map((category, index) => {
            const Icon = categoryIcons[index];
            return (
              <Link
                key={category.query}
                href={`${paths.search}?service=${encodeURIComponent(category.query)}`}
                className="group flex min-h-24 flex-col items-center justify-center gap-3 rounded-2xl px-2 py-3 text-center transition hover:-translate-y-0.5 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="grid size-12 place-items-center rounded-full border border-line bg-surface text-brand shadow-sm transition group-hover:border-brand/25 group-hover:shadow-card">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-black text-ink">{category.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={`mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-16 ${styles.sectionReveal}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">{t.companiesEyebrow}</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">{t.companiesTitle}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-base">{t.companiesLead}</p>
          </div>
          <Link href={paths.search} className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-brand hover:underline">
            {t.allCompanies}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {featuredResults.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredResults.map((result) => {
              const media = result.profile.media;
              const coverMedia = media && media.role !== "logo" ? media : null;
              const logoUrl = result.profile.logoUrl || (media?.role === "logo" ? media.url : "");
              const location = result.city || result.municipality || (locale === "en" ? "Sweden" : "Sverige");
              const reputation = result.profile.reputation && result.profile.reputation.verifiedReviews > 0
                ? result.profile.reputation
                : null;

              return (
                <article key={result.id} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-card">
                  <div className="relative aspect-[16/9] overflow-hidden border-b border-line">
                    <MarketplaceCompanyCover
                      name={result.companyName}
                      url={coverMedia?.url}
                      illustration={coverMedia?.role === "illustration"}
                    />
                    <span className="absolute right-3 top-3 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-2.5 text-[11px] font-black text-brand shadow-sm backdrop-blur-sm">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.verified}
                    </span>
                    {coverMedia?.role === "illustration" ? (
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white">{t.illustration}</span>
                    ) : null}
                  </div>

                  <div className="p-4">
                    <div className="-mt-10 flex items-end gap-3">
                      <MarketplaceCompanyLogo name={result.companyName} url={logoUrl} />
                      <h3 className="min-w-0 flex-1 break-words pb-1 text-lg font-black tracking-[-0.02em] text-ink">{result.companyName}</h3>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold text-body">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                        {location}
                      </span>
                      {reputation ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 fill-current text-brand" aria-hidden="true" />
                          <strong className="text-ink">{reputation.rating.toFixed(1)}</strong>
                          <span className="text-muted">({reputation.verifiedReviews} {t.profferaReviews})</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">
                        {directoryServiceLabel(result.matchedServiceSlug, result.matchedServiceLabel, locale)}
                      </span>
                      {result.profile.capabilities.onlineBooking ? (
                        <span className="rounded-full border border-line bg-surface-subtle px-3 py-1 text-xs font-bold text-body">
                          {locale === "en" ? "Online booking" : "Onlinebokning"}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <Link
                        href={profileHref(result, locale)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-sm font-black text-brand transition hover:border-brand/25 hover:bg-brand-soft"
                      >
                        {t.viewProfile}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                      </Link>
                      <a
                        href={googleSearchHref(result.companyName, location)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${t.google}: ${result.companyName}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-line bg-surface px-3 text-xs font-black text-body transition hover:bg-surface-subtle"
                      >
                        {t.google}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6">
            <p className="font-black text-ink">{locale === "en" ? "Explore published businesses" : "Utforska publicerade företag"}</p>
            <p className="text-sm leading-6 text-muted">{locale === "en" ? "Use service and location search to see currently published profiles." : "Använd tjänst och ort för att se de företagsprofiler som är publicerade just nu."}</p>
            <Link href={paths.search} className="inline-flex min-h-11 items-center gap-2 rounded-control bg-brand px-4 text-sm font-black text-white">
              {t.allCompanies}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section id="sa-fungerar" className={`border-y border-line bg-surface ${styles.sectionReveal}`}>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.65fr] lg:px-8 lg:py-14">
          <div>
            <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.howTitle}</h2>
            <p className="mt-3 max-w-md text-base leading-7 text-muted">{t.howLead}</p>
          </div>

          <div className="grid gap-0 md:grid-cols-3">
            {t.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <article key={step.title} className="border-t border-line py-5 first:border-t-0 md:border-l md:border-t-0 md:px-6 md:py-0 md:first:border-l-0">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-xs font-black text-brand">0{index + 1}</span>
                    <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 ${styles.sectionReveal}`}>
        <div className="grid overflow-hidden rounded-panel bg-brand-deep text-white shadow-card lg:grid-cols-[1fr_0.9fr]">
          <div className="p-7 sm:p-9 lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/60">{t.businessEyebrow}</p>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.businessTitle}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">{t.businessLead}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={businessHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-white px-6 text-sm font-black text-brand-deep transition hover:bg-white/90">
                {t.businessCta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={loginHref} className="inline-flex min-h-12 items-center justify-center rounded-control border border-white/25 px-6 text-sm font-black text-white transition hover:bg-white/10">
                {t.loginCta}
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/5 p-6 lg:border-l lg:border-t-0 lg:p-8">
            <div className="rounded-2xl border border-white/15 bg-white p-5 text-ink shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                <span className="text-sm font-black text-brand-deep">{t.workspaceLabel}</span>
                <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {t.workspaceItems.map((item, index) => (
                  <div key={item} className="rounded-xl bg-surface-subtle p-3">
                    <p className="text-xs font-black text-ink">{item}</p>
                    <span className={`mt-3 block h-2 rounded-full bg-line ${index % 2 === 0 ? "w-2/3" : "w-4/5"}`} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`border-y border-line bg-surface ${styles.sectionReveal}`}>
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_1.9fr] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">{t.sourcesEyebrow}</p>
            <h2 className="mt-2 text-xl font-black text-ink">{t.sourcesTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{t.sourcesLead}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {["Bolagsverket", "SCB", t.sourceOwner, t.sourceReviews].map((source) => (
              <div key={source} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-canvas px-4 text-sm font-black text-ink">
                <ShieldCheck className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                {source}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
