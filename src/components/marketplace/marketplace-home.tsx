import Link from "next/link";
import { ArrowRight, Building2, CalendarCheck2, CheckCircle2, ClipboardList, Search, ShieldCheck, Store } from "lucide-react";

import { directoryPaths, directoryServiceLabel } from "@/components/company-directory/public-directory-copy";
import { PublicDirectorySearchForm } from "@/components/company-directory/public-directory-search-form";
import { getPublishedDirectoryLocationSuggestions } from "@/lib/company-directory-public-search";
import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";
import type { PublicLocale } from "@/lib/public-locale";

type MarketplaceHomeCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  freeNote: string;
  categoriesTitle: string;
  categoriesLead: string;
  categories: Array<{ label: string; query: string }>;
  trust: string[];
  howEyebrow: string;
  howTitle: string;
  howLead: string;
  steps: Array<{ title: string; text: string }>;
  actionsEyebrow: string;
  actionsTitle: string;
  actionsLead: string;
  actions: Array<{ title: string; text: string }>;
  businessEyebrow: string;
  businessTitle: string;
  businessLead: string;
  businessCta: string;
  loginCta: string;
};

const copy: Record<PublicLocale, MarketplaceHomeCopy> = {
  sv: {
    eyebrow: "Hitta rätt hjälp",
    title: "Vad behöver du hjälp med?",
    lead: "Hitta företag, boka tid eller få offerter – gratis.",
    freeNote: "Gratis för dig som söker hjälp",
    categoriesTitle: "Populära tjänster",
    categoriesLead: "Välj en tjänst eller skriv själv vad du behöver hjälp med.",
    categories: [
      { label: "Frisör & barberare", query: "frisor" },
      { label: "Elektriker", query: "elinstallation" },
      { label: "VVS & rörmokare", query: "vvs" },
      { label: "Städning", query: "lokalvard" },
      { label: "Flytt & transport", query: "flytthjalp" },
      { label: "Målare", query: "malning" },
      { label: "Snickare", query: "snickeri" },
      { label: "Trädgård", query: "tradgardshjalp" },
    ],
    trust: ["Företagsuppgifter verifierade", "Boka eller begär offert", "Jämför företag på ett ställe"],
    howEyebrow: "Så fungerar Proffera",
    howTitle: "Från behov till rätt företag",
    howLead: "Du söker en gång. Proffera visar relevanta företag och låter varje tjänst styra nästa steg.",
    steps: [
      { title: "1. Sök", text: "Skriv tjänsten du behöver och var jobbet ska utföras." },
      { title: "2. Välj företag", text: "Se företagsprofil, tjänster och tillgängliga kundvägar." },
      { title: "3. Gå vidare", text: "Boka direkt, begär offert eller läs mer om företaget." },
    ],
    actionsEyebrow: "En marknadsplats, tre vägar vidare",
    actionsTitle: "Rätt knapp för rätt typ av tjänst",
    actionsLead: "En frisörtid kan bokas direkt. Ett större jobb kan behöva en offert först. Ett katalogföretag kan visas utan att ta emot transaktioner.",
    actions: [
      { title: "Boka tid", text: "För tjänster med pris, längd och tillgängliga tider." },
      { title: "Begär offert", text: "För jobb som behöver bedömas eller prissättas först." },
      { title: "Se företag", text: "För verifierade Directory-profiler utan aktiv bokning eller offert." },
    ],
    businessEyebrow: "Driver du företag?",
    businessTitle: "Få kunder från marknadsplatsen och hantera jobbet i samma arbetsyta.",
    businessLead: "Proffera kopplar ihop företagssida, bokning, offerter, CRM och uppdrag bakom kundresan.",
    businessCta: "För företag",
    loginCta: "Logga in",
  },
  en: {
    eyebrow: "Find the right help",
    title: "What do you need help with?",
    lead: "Find businesses, book an appointment or request quotes – free.",
    freeNote: "Free for customers looking for help",
    categoriesTitle: "Popular services",
    categoriesLead: "Choose a service or type what you need help with.",
    categories: [
      { label: "Hairdresser & barber", query: "frisor" },
      { label: "Electrician", query: "elinstallation" },
      { label: "Plumber", query: "vvs" },
      { label: "Cleaning", query: "lokalvard" },
      { label: "Moving & transport", query: "flytthjalp" },
      { label: "Painter", query: "malning" },
      { label: "Carpenter", query: "snickeri" },
      { label: "Gardening", query: "tradgardshjalp" },
    ],
    trust: ["Verified company details", "Book or request a quote", "Compare businesses in one place"],
    howEyebrow: "How Proffera works",
    howTitle: "From a need to the right business",
    howLead: "Search once. Proffera shows relevant businesses and lets each service control the next customer step.",
    steps: [
      { title: "1. Search", text: "Enter the service you need and where the work should be done." },
      { title: "2. Choose a business", text: "View the business profile, services and available customer actions." },
      { title: "3. Continue", text: "Book directly, request a quote or learn more about the business." },
    ],
    actionsEyebrow: "One marketplace, three next steps",
    actionsTitle: "The right action for the right service",
    actionsLead: "A salon appointment can be booked directly. A larger job may need a quote first. A directory business can still be visible without taking transactions.",
    actions: [
      { title: "Book", text: "For services with a price, duration and available times." },
      { title: "Request quote", text: "For work that needs assessment or pricing first." },
      { title: "View business", text: "For verified Directory profiles without active booking or quote actions." },
    ],
    businessEyebrow: "Do you run a business?",
    businessTitle: "Win customers from the marketplace and manage the work in the same workspace.",
    businessLead: "Proffera connects your business page, booking, quotes, CRM and jobs behind the customer journey.",
    businessCta: "For businesses",
    loginCta: "Log in",
  },
};

const stepIcons = [Search, Store, CheckCircle2] as const;
const actionIcons = [CalendarCheck2, ClipboardList, Building2] as const;

export async function MarketplaceHome({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const paths = directoryPaths[locale];
  const businessHref = locale === "en" ? "/en/for-business" : "/for-foretag";
  const loginHref = locale === "en" ? "/logga-in?lang=en" : "/logga-in?lang=sv";
  const locationSuggestions = await getPublishedDirectoryLocationSuggestions(60);
  const serviceSuggestions = DIRECTORY_SERVICES.map((item) => directoryServiceLabel(item.slug, item.label, locale));

  return (
    <div className="bg-canvas text-ink">
      <section className="relative overflow-hidden border-b border-line bg-brand-deep text-white">
        <div className="absolute -right-36 -top-40 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-48 -left-24 h-96 w-96 rounded-full bg-brand/40 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-white/60">{t.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">{t.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/75 sm:text-xl">{t.lead}</p>
          </div>

          <div className="mt-8 max-w-5xl">
            <PublicDirectorySearchForm
              locale={locale}
              service=""
              location=""
              serviceSuggestions={serviceSuggestions}
              locationSuggestions={locationSuggestions}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/70">
            <span className="inline-flex items-center gap-2 text-white"><ShieldCheck className="h-4 w-4" />{t.freeNote}</span>
            {t.trust.map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-white/75" />{item}</span>)}
          </div>
        </div>
      </section>

      <section id="populara-tjanster" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{t.categoriesTitle}</h2>
          <p className="mt-2 text-base leading-7 text-muted">{t.categoriesLead}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {t.categories.map((category) => (
            <Link
              key={category.query}
              href={`${paths.search}?service=${encodeURIComponent(category.query)}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-black text-brand shadow-sm transition hover:border-brand/30 hover:bg-brand-soft"
            >
              {category.label}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </section>

      <section id="sa-fungerar" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.howEyebrow}</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.howTitle}</h2>
            <p className="max-w-2xl text-base leading-7 text-muted lg:justify-self-end">{t.howLead}</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {t.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <article key={step.title} className="rounded-panel border border-line bg-canvas p-6 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-control bg-brand-soft text-brand"><Icon className="h-5 w-5" /></span>
                  <h3 className="mt-5 text-lg font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.actionsEyebrow}</p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.actionsTitle}</h2>
          <p className="max-w-2xl text-base leading-7 text-muted lg:justify-self-end">{t.actionsLead}</p>
        </div>
        <div className="mt-9 overflow-hidden rounded-panel border border-line bg-surface shadow-card md:grid md:grid-cols-3">
          {t.actions.map((action, index) => {
            const Icon = actionIcons[index];
            return (
              <article key={action.title} className="border-b border-line p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-brand text-white"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-xl font-black">{action.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{action.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-line bg-brand-tint">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.businessEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.businessTitle}</h2>
            <p className="mt-4 text-base leading-7 text-muted">{t.businessLead}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link href={businessHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-6 text-sm font-black text-white transition hover:bg-brand-strong">
              {t.businessCta}<ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={loginHref} className="inline-flex min-h-12 items-center justify-center rounded-control border border-brand/25 bg-surface px-6 text-sm font-black text-brand transition hover:bg-brand-soft">
              {t.loginCta}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
