import Link from "next/link";
import { ArrowRight, CheckCircle2, Hammer, Leaf, Paintbrush, Scissors, Search, Sparkles, Store, Truck, Wrench, Zap } from "lucide-react";

import { directoryPaths } from "@/components/company-directory/public-directory-copy";
import { PublicDirectorySearchForm } from "@/components/company-directory/public-directory-search-form";
import { getPublishedDirectoryLocationSuggestions } from "@/lib/company-directory-public-search";
import type { PublicLocale } from "@/lib/public-locale";

type MarketplaceHomeCopy = {
  title: string;
  lead: string;
  trust: string[];
  categoriesTitle: string;
  categoriesLead: string;
  categories: Array<{ label: string; query: string }>;
  allServices: string;
  howTitle: string;
  howLead: string;
  steps: Array<{ title: string; text: string }>;
  businessEyebrow: string;
  businessTitle: string;
  businessLead: string;
  businessCta: string;
  loginCta: string;
};

const copy: Record<PublicLocale, MarketplaceHomeCopy> = {
  sv: {
    title: "Vad behöver du hjälp med?",
    lead: "Sök tjänst och plats. Jämför företag, boka direkt eller begär offert.",
    trust: ["Gratis att söka", "Företagsuppgifter verifierade", "Boka eller begär offert"],
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
    allServices: "Se alla tjänster",
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
  },
  en: {
    title: "What do you need help with?",
    lead: "Search by service and location. Compare businesses, book directly or request a quote.",
    trust: ["Free to search", "Verified company details", "Book or request a quote"],
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
    allServices: "View all services",
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
  },
};

const categoryIcons = [Scissors, Zap, Wrench, Sparkles, Truck, Paintbrush, Hammer, Leaf] as const;
const stepIcons = [Search, Store, CheckCircle2] as const;

export async function MarketplaceHome({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const paths = directoryPaths[locale];
  const businessHref = locale === "en" ? "/en/for-business" : "/for-foretag";
  const loginHref = locale === "en" ? "/logga-in?lang=en" : "/logga-in?lang=sv";
  const locationSuggestions = (await getPublishedDirectoryLocationSuggestions(24)).slice(0, 12);
  const serviceSuggestions = t.categories.map((category) => category.label);

  return (
    <div className="bg-canvas text-ink">
      <section className="border-b border-line bg-[#f7f8f4]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="text-4xl font-black leading-[1.02] tracking-[-0.045em] text-ink sm:text-5xl lg:text-6xl">{t.title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted sm:text-xl">{t.lead}</p>

            <div className="mx-auto mt-8 max-w-5xl text-left">
              <PublicDirectorySearchForm
                locale={locale}
                service=""
                location=""
                serviceSuggestions={serviceSuggestions}
                locationSuggestions={locationSuggestions}
                tone="light"
                layout="hero"
              />
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-bold text-muted">
              {t.trust.map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="populara-tjanster" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{t.categoriesTitle}</h2>
            <p className="mt-2 text-base leading-7 text-muted">{t.categoriesLead}</p>
          </div>
          <Link href={paths.search} className="inline-flex items-center gap-2 text-sm font-black text-brand hover:underline">
            {t.allServices}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {t.categories.map((category, index) => {
            const Icon = categoryIcons[index];
            return (
              <Link
                key={category.query}
                href={`${paths.search}?service=${encodeURIComponent(category.query)}`}
                className="group flex min-h-28 flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-5 flex items-center justify-between gap-3 text-left text-sm font-black sm:text-base">
                  {category.label}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="sa-fungerar" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.howTitle}</h2>
            <p className="mt-3 text-base leading-7 text-muted">{t.howLead}</p>
          </div>

          <div className="mx-auto mt-9 grid max-w-5xl gap-4 md:grid-cols-3">
            {t.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <article key={step.title} className="rounded-2xl border border-line bg-canvas p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-7 rounded-3xl bg-brand-deep px-6 py-8 text-white sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-10">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-white/60">{t.businessEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.businessTitle}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">{t.businessLead}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link href={businessHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-black text-brand-deep transition hover:bg-white/90">
              {t.businessCta}<ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={loginHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-black text-white transition hover:bg-white/10">
              {t.loginCta}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
