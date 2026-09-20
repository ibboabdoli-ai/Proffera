import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Ellipsis,
  ExternalLink,
  Hammer,
  House,
  MapPin,
  PaintRoller,
  Search,
  Snowflake,
  Sparkles,
  Sprout,
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

type ServiceShortcut = {
  label: string;
  query: string | null;
};

type MarketplaceHomeCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  trust: string[];
  categoriesTitle: string;
  categoriesLead: string;
  categories: ServiceShortcut[];
  allServices: string;
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
  sourcesEyebrow: string;
  sourcesLead: string;
  sourceOwner: string;
  sourceReviews: string;
  heroTrustTitle: string;
  heroTrustLead: string;
};

const copy: Record<PublicLocale, MarketplaceHomeCopy> = {
  sv: {
    eyebrow: "Lokala företag. Verifierade uppgifter.",
    title: "Vad behöver du hjälp med?",
    lead: "Hitta företag, boka tid eller få offerter – gratis.",
    trust: ["Gratis att söka", "Företagsuppgifter verifierade", "Boka tid · Begär offert · Se omdömen"],
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
      { label: "Bygg & renovering", query: null },
      { label: "Kyla & värmepumpar", query: "varmepump" },
      { label: "Fler tjänster", query: null },
    ],
    allServices: "Se alla tjänster",
    companiesTitle: "Företag nära dig",
    companiesLead: "Upptäck publicerade företag med verifierade grunduppgifter och riktig profilmedia när den finns.",
    allCompanies: "Se alla företag",
    verified: "Verifierad",
    illustration: "Illustrationsbild",
    profferaReviews: "verifierade Proffera-omdömen",
    viewProfile: "Visa profil",
    google: "Google",
    howTitle: "Så fungerar Proffera",
    howLead: "Tre enkla steg från sökning till rätt företag.",
    steps: [
      { title: "Sök", text: "Skriv vad du behöver hjälp med och var jobbet ska utföras." },
      { title: "Jämför", text: "Se relevanta företag, tjänster och omdömen." },
      { title: "Välj", text: "Boka tid, begär offert eller öppna företagets profil." },
    ],
    businessEyebrow: "För företag",
    businessTitle: "Vill du få fler kunder via Proffera?",
    businessLead: "Hantera bokningar, offerter, kunder och jobb från samma arbetsyta.",
    businessCta: "För företag",
    loginCta: "Logga in",
    sourcesEyebrow: "Transparens först",
    sourcesLead: "Företagsinformation från tydligt identifierade källor.",
    sourceOwner: "Företagets uppgifter",
    sourceReviews: "Proffera-omdömen",
    heroTrustTitle: "Verifierade företag",
    heroTrustLead: "Tryggt, enkelt och lokalt.",
  },
  en: {
    eyebrow: "Local businesses. Verified details.",
    title: "What do you need help with?",
    lead: "Find businesses, book an appointment or request quotes – free.",
    trust: ["Free to search", "Verified company details", "Book appointment · Request quote · View reviews"],
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
      { label: "Building & renovation", query: null },
      { label: "Cooling & heat pumps", query: "varmepump" },
      { label: "More services", query: null },
    ],
    allServices: "View all services",
    companiesTitle: "Businesses near you",
    companiesLead: "Discover published businesses with verified core details and real profile media where available.",
    allCompanies: "View all businesses",
    verified: "Verified",
    illustration: "Illustration",
    profferaReviews: "verified Proffera reviews",
    viewProfile: "View profile",
    google: "Google",
    howTitle: "How Proffera works",
    howLead: "Three simple steps from search to the right business.",
    steps: [
      { title: "Search", text: "Enter what you need help with and where the work should be done." },
      { title: "Compare", text: "See relevant businesses, services and reviews." },
      { title: "Choose", text: "Book an appointment, request a quote or open the business profile." },
    ],
    businessEyebrow: "For businesses",
    businessTitle: "Want to win more customers through Proffera?",
    businessLead: "Manage bookings, quotes, customers and jobs from the same workspace.",
    businessCta: "For businesses",
    loginCta: "Log in",
    sourcesEyebrow: "Transparency first",
    sourcesLead: "Business information from clearly identified sources.",
    sourceOwner: "Business-provided details",
    sourceReviews: "Proffera reviews",
    heroTrustTitle: "Verified businesses",
    heroTrustLead: "Clear, local and easy to compare.",
  },
};

const categoryIcons = [
  Zap,
  Wrench,
  Sparkles,
  Truck,
  PaintRoller,
  Hammer,
  Sprout,
  House,
  Snowflake,
  Ellipsis,
] as const;

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

  const serviceSuggestions = t.categories
    .filter((category) => category.query)
    .map((category) => category.label);

  const featuredResults = companies.results.slice(0, 4);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={`${styles.heroCopy} ${styles.contentColumn}`}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 className={styles.heroTitle}>{t.title}</h1>
            <p className={styles.heroLead}>{t.lead}</p>

            <div className={styles.marketplaceSearch}>
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

            <div className={styles.trustRow}>
              {t.trust.map((item) => (
                <span key={item}>
                  <CheckCircle2 aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            {/* Editorial service imagery; replace with Proffera-owned media before Production merge. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=88&w=2200"
              alt=""
              className={styles.heroImage}
            />
            <div className={styles.heroTrustCard}>
              <span className={styles.heroTrustIcon}><BadgeCheck aria-hidden="true" /></span>
              <span>
                <strong>{t.heroTrustTitle}</strong>
                <small>{t.heroTrustLead}</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="populara-tjanster" className={`${styles.section} ${styles.sectionReveal}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{t.categoriesTitle}</h2>
            <p>{t.categoriesLead}</p>
          </div>
          <Link href={paths.search} className={styles.textLink}>
            {t.allServices}<ArrowRight aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.serviceRail}>
          {t.categories.map((category, index) => {
            const Icon = categoryIcons[index];
            const href = category.query
              ? `${paths.search}?service=${encodeURIComponent(category.query)}`
              : paths.search;

            return (
              <Link key={category.label} href={href} className={styles.serviceShortcut}>
                <span className={styles.serviceIcon}><Icon aria-hidden="true" /></span>
                <span>{category.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={`${styles.companySection} ${styles.sectionReveal}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{t.companiesTitle}</h2>
            <p>{t.companiesLead}</p>
          </div>
          <Link href={paths.search} className={styles.textLink}>
            {t.allCompanies}<ArrowRight aria-hidden="true" />
          </Link>
        </div>

        {featuredResults.length > 0 ? (
          <div className={styles.companyGrid}>
            {featuredResults.map((result) => {
              const media = result.profile.media;
              const coverMedia = media && media.role !== "logo" ? media : null;
              const logoUrl = result.profile.logoUrl || (media?.role === "logo" ? media.url : "");
              const location = result.city || result.municipality || (locale === "en" ? "Sweden" : "Sverige");
              const reputation = result.profile.reputation && result.profile.reputation.verifiedReviews > 0
                ? result.profile.reputation
                : null;

              return (
                <article key={result.id} className={`group ${styles.companyCard}`}>
                  <div className={styles.companyCover}>
                    <MarketplaceCompanyCover
                      name={result.companyName}
                      url={coverMedia?.role === "illustration" ? undefined : coverMedia?.url}
                      illustration={coverMedia?.role === "illustration" || !coverMedia?.url}
                      serviceSlug={result.matchedServiceSlug}
                    />
                    <span className={styles.verifiedBadge}>
                      <BadgeCheck aria-hidden="true" />
                      {t.verified}
                    </span>
                    {coverMedia?.role === "illustration" || !coverMedia?.url ? (
                      <span className={styles.illustrationBadge}>{t.illustration}</span>
                    ) : null}
                  </div>

                  <div className={styles.companyBody}>
                    <div className={styles.companyIdentity}>
                      <MarketplaceCompanyLogo name={result.companyName} url={logoUrl} />
                      <h3>{result.companyName}</h3>
                    </div>

                    <div className={styles.companyMeta}>
                      {reputation ? (
                        <span className={styles.rating}>
                          <Star aria-hidden="true" />
                          <strong>{reputation.rating.toFixed(1)}</strong>
                          <span>({reputation.verifiedReviews} {t.profferaReviews})</span>
                        </span>
                      ) : null}
                      <span><MapPin aria-hidden="true" />{location}</span>
                    </div>

                    <div className={styles.companyTags}>
                      <span>{directoryServiceLabel(result.matchedServiceSlug, result.matchedServiceLabel, locale)}</span>
                      {result.profile.capabilities.onlineBooking ? (
                        <span>{locale === "en" ? "Online booking" : "Onlinebokning"}</span>
                      ) : null}
                    </div>

                    <div className={styles.companyActions}>
                      <Link href={profileHref(result, locale)} className={styles.profileLink}>
                        {t.viewProfile}<ArrowRight aria-hidden="true" />
                      </Link>
                      <a
                        href={googleSearchHref(result.companyName, location)}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.googleLink}
                        aria-label={`${t.google}: ${result.companyName}`}
                      >
                        {t.google}<ExternalLink aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>{locale === "en" ? "Explore currently published businesses." : "Utforska de företagsprofiler som är publicerade just nu."}</p>
            <Link href={paths.search}>{t.allCompanies}<ArrowRight aria-hidden="true" /></Link>
          </div>
        )}
      </section>

      <section id="sa-fungerar" className={`${styles.howSection} ${styles.sectionReveal}`}>
        <div className={styles.howGrid}>
          <div>
            <h2>{t.howTitle}</h2>
            <p>{t.howLead}</p>
          </div>
          <div className={styles.steps}>
            {t.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <article key={step.title} className={styles.step}>
                  <div className={styles.stepTop}>
                    <span>0{index + 1}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${styles.businessSection} ${styles.sectionReveal}`}>
        <div className={styles.businessCard}>
          <div className={styles.businessCopy}>
            <p className={styles.eyebrow}>{t.businessEyebrow}</p>
            <h2>{t.businessTitle}</h2>
            <p>{t.businessLead}</p>
            <div className={styles.businessActions}>
              <Link href={businessHref} className={styles.businessPrimary}>
                {t.businessCta}<ArrowRight aria-hidden="true" />
              </Link>
              <Link href={loginHref} className={styles.businessSecondary}>{t.loginCta}</Link>
            </div>
          </div>
          <div className={styles.businessVisual} aria-hidden="true">
            {/* Editorial workspace imagery; replace with Proffera-owned media before Production merge. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&q=86&w=1800"
              alt=""
            />
          </div>
        </div>
      </section>

      <section className={`${styles.sourcesSection} ${styles.sectionReveal}`}>
        <div className={styles.sourcesGrid}>
          <div>
            <p className={styles.eyebrow}>{t.sourcesEyebrow}</p>
            <p className={styles.sourcesLead}>{t.sourcesLead}</p>
          </div>
          {["Bolagsverket", "SCB", t.sourceOwner, t.sourceReviews].map((source) => (
            <span key={source} className={styles.sourceItem}>
              <CheckCircle2 aria-hidden="true" />
              {source}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
