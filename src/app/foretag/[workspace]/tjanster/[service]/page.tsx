import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowLeft, CalendarCheck2, Clock3, Languages, Mail, MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import { DocumentLanguageSync } from "@/components/layout/document-language-sync";
import { PublicBusinessContactForm } from "@/components/public-business/public-contact-form";
import { PublicBusinessQuoteForm } from "@/components/public-business/public-quote-form";
import { PublicBusinessTrackedLink, PublicBusinessViewEvent } from "@/components/public-business/public-business-tracking";
import { formatPublicBusinessPrice, getPublicBusinessService } from "@/lib/public-business-hub";
import {
  firstPublicBusinessLocaleParam,
  publicBusinessCopy,
  resolvePublicBusinessLocale,
  withPublicBusinessLocale,
} from "@/lib/public-business-locale";
import {
  buildPublicServiceJsonLd,
  resolvePublicBusinessUrlContext,
  serializePublicBusinessJsonLd,
} from "@/lib/public-business-seo";

import styles from "./public-service-page.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspace: string; service: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { workspace, service } = await params;
  const query = searchParams ? await searchParams : undefined;
  const [result, requestHeaders] = await Promise.all([getPublicBusinessService(workspace, service), headers()]);
  if (!result) return {};

  const locale = resolvePublicBusinessLocale(result.workspace.experience, firstPublicBusinessLocaleParam(query?.lang));
  const urls = await resolvePublicBusinessUrlContext(requestHeaders.get("host"), result.workspace.slug);
  const canonical = urls.serviceCanonical(result.service.publicSlug);
  const title = result.service.seoTitle || `${result.service.name} – ${result.workspace.companyName}`;
  const description = result.service.seoDescription || result.service.shortDescription || result.service.description || (locale === "en"
    ? `Learn more about ${result.service.name} from ${result.workspace.companyName}.`
    : `Läs mer om ${result.service.name} hos ${result.workspace.companyName}.`);
  const images = result.service.coverImageUrl ? [{ url: result.service.coverImageUrl, alt: result.service.name }] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "website", url: canonical, images },
  };
}

export default async function PublicServicePage({ params, searchParams }: Props) {
  const { workspace, service } = await params;
  const query = searchParams ? await searchParams : undefined;
  const [result, requestHeaders] = await Promise.all([getPublicBusinessService(workspace, service), headers()]);
  if (!result) notFound();

  const { workspace: business, service: item } = result;
  const experience = business.experience;
  const locale = resolvePublicBusinessLocale(experience, firstPublicBusinessLocaleParam(query?.lang));
  const urls = await resolvePublicBusinessUrlContext(requestHeaders.get("host"), business.slug);
  const jsonLd = buildPublicServiceJsonLd(business, item, urls);
  const t = publicBusinessCopy[locale];
  const serviceCopy = t.service;
  const otherLocale = locale === "sv" ? "en" : "sv";
  const showLanguageSwitch = experience.swedishEnabled && experience.englishEnabled;
  const companyHref = withPublicBusinessLocale(urls.companyHref, locale);
  const languageSwitchHref = withPublicBusinessLocale(urls.serviceHref(item.publicSlug), otherLocale);

  const dark = experience.appearance === "dark";
  const background = dark ? "#101512" : experience.themeKey === "premium" ? "#f4f0e8" : experience.themeKey === "modern" ? "#edf4f6" : "#f8fafc";
  const card = dark ? "#19211c" : "#ffffff";
  const text = dark ? "#f5f7f5" : "#11213b";
  const muted = dark ? "#b9c3bc" : "#617085";
  const subtleBorder = dark ? "rgba(255,255,255,.16)" : "#dce4ee";
  const style = {
    "--business-primary": experience.primaryColor,
    "--business-accent": experience.accentColor,
    "--business-bg": background,
    "--business-card": card,
    "--business-text": text,
    "--business-muted": muted,
    "--business-border": subtleBorder,
  } as CSSProperties;

  const price = formatPublicBusinessPrice(item, business.billingCurrency, locale === "en" ? "en-SE" : "sv-SE");
  const canBook = business.bookingEnabled && Boolean(business.bookingSlug) && (item.conversionMode === "book" || item.conversionMode === "book_or_quote");
  const canQuote = item.conversionMode === "quote" || item.conversionMode === "book_or_quote";
  const canContact = item.conversionMode === "contact";
  const bookingHref = withPublicBusinessLocale(`/boka/${encodeURIComponent(business.bookingSlug)}?service_id=${encodeURIComponent(item.id)}`, locale);

  return (
    <main lang={locale} style={style} className={`${styles.page} px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-10`}>
      <DocumentLanguageSync locale={locale} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializePublicBusinessJsonLd(jsonLd) }} />
      <PublicBusinessViewEvent workspaceId={business.id} serviceId={item.id} />

      <div className={styles.shell}>
        <div className={styles.topbar}>
          <a href={companyHref} className={styles.backLink}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {serviceCopy.backTo(business.companyName)}
          </a>
          {showLanguageSwitch ? (
            <a href={languageSwitchHref} aria-label={t.languageSwitchLabel} className={styles.languageLink}>
              <Languages className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t.languageSwitch}</span>
            </a>
          ) : null}
        </div>

        <section className={styles.hero}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              {item.category ? <p className={styles.eyebrow}>{item.category}</p> : null}
              <h1 className={styles.title}>{item.name}</h1>
              <p className={styles.lead}>{item.shortDescription || item.description || serviceCopy.fallback}</p>

              <div className={styles.meta}>
                {price ? <span>{price}</span> : null}
                {item.durationMinutes ? <span><Clock3 aria-hidden="true" />{item.durationMinutes} min</span> : null}
                {item.serviceArea ? <span><MapPin aria-hidden="true" />{item.serviceArea}</span> : null}
              </div>

              <div className="mt-8 hidden flex-wrap gap-3 lg:flex">
                {canBook ? (
                  <PublicBusinessTrackedLink
                    workspaceId={business.id}
                    serviceId={item.id}
                    eventKey="book_clicked"
                    href={bookingHref}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--business-primary)] px-5 font-black text-white"
                  >
                    <CalendarCheck2 className="mr-2 h-5 w-5" aria-hidden="true" />{serviceCopy.bookOnline}
                  </PublicBusinessTrackedLink>
                ) : null}
                {canQuote ? (
                  <PublicBusinessTrackedLink
                    workspaceId={business.id}
                    serviceId={item.id}
                    eventKey="quote_clicked"
                    href="#offert"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 px-5 font-black"
                  >
                    {serviceCopy.requestQuote}
                  </PublicBusinessTrackedLink>
                ) : null}
                {canContact ? (
                  <PublicBusinessTrackedLink
                    workspaceId={business.id}
                    serviceId={item.id}
                    eventKey="contact_clicked"
                    href="#kontaktforfragan"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/15 px-5 font-black"
                  >
                    <Mail className="mr-2 h-4 w-4" aria-hidden="true" />{serviceCopy.contact}
                  </PublicBusinessTrackedLink>
                ) : null}
              </div>
            </div>

            <div className={styles.heroMedia}>
              {item.coverImageUrl ? (
                // Public tenant media can live on tenant-specific Blob/CDN hosts.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.coverImageUrl} alt={item.name} />
              ) : (
                <div className={styles.fallback}>
                  <div className="text-center">
                    <div className={styles.fallbackMark}>{item.name.slice(0, 1).toUpperCase()}</div>
                    <p className={styles.fallbackCompany}>{business.companyName}</p>
                    {business.primaryCity ? <p className={styles.fallbackCity}>{business.primaryCity}</p> : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {item.description && item.description !== item.shortDescription ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{serviceCopy.about}</h2>
            <p className={`${styles.sectionText} whitespace-pre-line`}>{item.description}</p>
          </section>
        ) : null}

        {canQuote ? (
          <section id="offert" className={`scroll-mt-24 ${styles.section}`}>
            <div className="mb-5">
              <p className={styles.eyebrow}>{serviceCopy.quoteEyebrow}</p>
              <h2 className={styles.sectionTitle}>{serviceCopy.quoteTitle}</h2>
              <p className={styles.sectionText}>{serviceCopy.quoteLead(business.companyName, item.name)}</p>
            </div>
            <PublicBusinessQuoteForm workspaceSlug={business.slug} serviceId={item.id} serviceName={item.name} locale={locale} />
          </section>
        ) : null}

        {canContact ? (
          <section id="kontaktforfragan" className={`scroll-mt-24 ${styles.section}`}>
            <div className="mb-5">
              <p className={styles.eyebrow}>{serviceCopy.contactEyebrow}</p>
              <h2 className={styles.sectionTitle}>{serviceCopy.contactTitle}</h2>
              <p className={styles.sectionText}>{serviceCopy.contactLead(business.companyName)}</p>
            </div>
            <PublicBusinessContactForm workspaceId={business.id} serviceId={item.id} locale={locale} />
          </section>
        ) : null}

        {experience.contactEnabled && (business.contactEmail || business.contactPhone) ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{serviceCopy.contactDetails}</h2>
            <div className={styles.contactLinks}>
              {business.contactPhone ? (
                <PublicBusinessTrackedLink
                  workspaceId={business.id}
                  serviceId={item.id}
                  eventKey="contact_clicked"
                  href={`tel:${business.contactPhone}`}
                  className={styles.contactLink}
                >
                  <Phone aria-hidden="true" />{business.contactPhone}
                </PublicBusinessTrackedLink>
              ) : null}
              {business.contactEmail ? (
                <PublicBusinessTrackedLink
                  workspaceId={business.id}
                  serviceId={item.id}
                  eventKey="contact_clicked"
                  href={`mailto:${business.contactEmail}?subject=${encodeURIComponent(item.name)}`}
                  className={styles.contactLink}
                >
                  <Mail aria-hidden="true" />{business.contactEmail}
                </PublicBusinessTrackedLink>
              ) : null}
            </div>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} {business.companyName}</span>
          <span>{serviceCopy.footer}</span>
        </footer>
      </div>

      {canBook || canQuote || canContact ? (
        <div
          style={{ background: card, borderColor: subtleBorder, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          className="fixed inset-x-0 bottom-0 z-40 border-t px-3 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,.08)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-5xl gap-2">
            {canBook ? (
              <PublicBusinessTrackedLink
                workspaceId={business.id}
                serviceId={item.id}
                eventKey="book_clicked"
                href={bookingHref}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--business-primary)] px-4 text-sm font-black text-white"
              >
                <CalendarCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />{serviceCopy.bookOnline}
              </PublicBusinessTrackedLink>
            ) : null}
            {canQuote ? (
              <PublicBusinessTrackedLink
                workspaceId={business.id}
                serviceId={item.id}
                eventKey="quote_clicked"
                href="#offert"
                className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 text-sm font-black ${canBook ? "border border-black/15" : "bg-[var(--business-primary)] text-white"}`}
              >
                {serviceCopy.requestQuote}
              </PublicBusinessTrackedLink>
            ) : null}
            {canContact ? (
              <PublicBusinessTrackedLink
                workspaceId={business.id}
                serviceId={item.id}
                eventKey="contact_clicked"
                href="#kontaktforfragan"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--business-primary)] px-4 text-sm font-black text-white"
              >
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />{serviceCopy.contact}
              </PublicBusinessTrackedLink>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
