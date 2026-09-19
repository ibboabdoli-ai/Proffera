import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowRight, Clock3, Languages, Mail, MapPin, Phone, Star } from "lucide-react";
import { notFound } from "next/navigation";

import { PublicBusinessContactForm } from "@/components/public-business/public-contact-form";
import { PublicBusinessTrackedLink, PublicBusinessViewEvent } from "@/components/public-business/public-business-tracking";
import { formatPublicBusinessPrice, getPublicBusinessHub } from "@/lib/public-business-hub";
import {
  firstPublicBusinessLocaleParam,
  publicBusinessCopy,
  resolvePublicBusinessLocale,
  withPublicBusinessLocale,
} from "@/lib/public-business-locale";
import {
  buildPublicBusinessJsonLd,
  resolvePublicBusinessUrlContext,
  serializePublicBusinessJsonLd,
} from "@/lib/public-business-seo";

import styles from "./public-business-page.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspace: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { workspace } = await params;
  const query = searchParams ? await searchParams : undefined;
  const [hub, requestHeaders] = await Promise.all([getPublicBusinessHub(workspace), headers()]);
  if (!hub) return {};

  const locale = resolvePublicBusinessLocale(hub.workspace.experience, firstPublicBusinessLocaleParam(query?.lang));
  const urls = await resolvePublicBusinessUrlContext(requestHeaders.get("host"), hub.workspace.slug);
  const title = hub.workspace.companyName;
  const description = hub.workspace.businessIntro || (locale === "en"
    ? `${title} – services, booking and contact via Proffera.`
    : `${title} – tjänster, bokning och kontakt via Proffera.`);

  return {
    title,
    description,
    alternates: { canonical: urls.companyCanonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: urls.companyCanonical,
      images: hub.workspace.experience.heroImageUrl
        ? [{ url: hub.workspace.experience.heroImageUrl, alt: hub.workspace.companyName }]
        : hub.workspace.experience.logoUrl
          ? [{ url: hub.workspace.experience.logoUrl, alt: hub.workspace.companyName }]
          : undefined,
    },
  };
}

export default async function PublicBusinessPage({ params, searchParams }: Props) {
  const { workspace } = await params;
  const query = searchParams ? await searchParams : undefined;
  const [hub, requestHeaders] = await Promise.all([getPublicBusinessHub(workspace), headers()]);
  if (!hub) notFound();

  const { workspace: business, services, reviews, gallery } = hub;
  const experience = business.experience;
  const locale = resolvePublicBusinessLocale(experience, firstPublicBusinessLocaleParam(query?.lang));
  const urls = await resolvePublicBusinessUrlContext(requestHeaders.get("host"), business.slug);
  const jsonLd = buildPublicBusinessJsonLd(business, services, urls);
  const t = publicBusinessCopy[locale];
  const companyCopy = t.company;
  const otherLocale = locale === "sv" ? "en" : "sv";
  const showLanguageSwitch = experience.swedishEnabled && experience.englishEnabled;
  const languageSwitchHref = withPublicBusinessLocale(urls.companyHref, otherLocale);

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

  const bookingHref = business.bookingEnabled && business.bookingSlug
    ? withPublicBusinessLocale(`/boka/${encodeURIComponent(business.bookingSlug)}`, locale)
    : "";

  const hasHeroMedia = Boolean(experience.heroImageUrl || experience.heroVideoUrl);

  return (
    <main lang={locale} style={style} className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializePublicBusinessJsonLd(jsonLd) }} />
      <PublicBusinessViewEvent workspaceId={business.id} />

      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.identity}>
            {experience.logoUrl ? (
              // Public tenant logos can live on tenant-specific Blob/CDN hosts.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={experience.logoUrl} alt={`${business.companyName} ${locale === "en" ? "logo" : "logotyp"}`} className={styles.logoImage} />
            ) : (
              <div className={styles.logoFallback}>{business.companyName.slice(0, 1).toUpperCase()}</div>
            )}
            <div className={styles.identityText}>
              <p className={styles.companyName}>{business.companyName}</p>
              {business.primaryCity ? <p className={styles.companyCity}>{business.primaryCity}</p> : null}
            </div>
          </div>

          <div className={styles.headerActions}>
            {showLanguageSwitch ? (
              <a href={languageSwitchHref} aria-label={t.languageSwitchLabel} className={styles.languageButton}>
                <Languages className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t.languageSwitch}</span>
              </a>
            ) : null}
            {bookingHref ? (
              <PublicBusinessTrackedLink
                workspaceId={business.id}
                eventKey="book_clicked"
                href={bookingHref}
                className={styles.headerBook}
              >
                {companyCopy.bookTime}
              </PublicBusinessTrackedLink>
            ) : null}
          </div>
        </header>

        {experience.heroEnabled ? (
          <section className={styles.hero}>
            <div className={`${styles.heroGrid} ${hasHeroMedia ? "" : styles.heroSolo}`}>
              <div className={styles.heroCopy}>
                <p className={styles.heroEyebrow}>{companyCopy.heroEyebrow}</p>
                <h1 className={styles.heroTitle}>{business.companyName}</h1>
                {business.primaryCity ? (
                  <p className={styles.heroCity}>
                    <MapPin aria-hidden="true" />
                    {business.primaryCity}
                  </p>
                ) : null}
                <p className={styles.heroIntro}>{business.businessIntro || companyCopy.defaultIntro}</p>

                <div className={styles.heroActions}>
                  {services.length ? (
                    <a href="#tjanster" className={styles.primaryAction}>
                      {companyCopy.seeServices}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : bookingHref ? (
                    <PublicBusinessTrackedLink
                      workspaceId={business.id}
                      eventKey="book_clicked"
                      href={bookingHref}
                      className={styles.primaryAction}
                    >
                      {companyCopy.bookOnline}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </PublicBusinessTrackedLink>
                  ) : null}

                  {experience.contactEnabled ? (
                    <PublicBusinessTrackedLink
                      workspaceId={business.id}
                      eventKey="contact_clicked"
                      href="#kontakt"
                      className={styles.secondaryAction}
                    >
                      {companyCopy.contactUs}
                    </PublicBusinessTrackedLink>
                  ) : null}
                </div>
              </div>

              {experience.heroVideoUrl ? (
                <div className={styles.heroMedia}>
                  <video src={experience.heroVideoUrl} controls muted playsInline />
                </div>
              ) : experience.heroImageUrl ? (
                <div className={styles.heroMedia}>
                  {/* Public tenant media can live on tenant-specific Blob/CDN hosts. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={experience.heroImageUrl} alt="" />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {experience.servicesEnabled ? (
          <section className={styles.section} id="tjanster">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>{companyCopy.servicesEyebrow}</p>
                <h2 className={styles.sectionTitle}>{companyCopy.servicesTitle}</h2>
              </div>
              <p className={styles.sectionLead}>{companyCopy.servicesLead}</p>
            </div>

            {services.length ? (
              <div className={styles.serviceList}>
                {services.map((service) => {
                  const price = formatPublicBusinessPrice(service, business.billingCurrency, locale === "en" ? "en-SE" : "sv-SE");
                  const serviceHref = withPublicBusinessLocale(urls.serviceHref(service.publicSlug), locale);
                  const modeLabel = companyCopy.serviceMode[service.conversionMode];

                  return (
                    <a key={service.id} href={serviceHref} className={styles.serviceCard}>
                      <div className={styles.serviceVisual}>
                        {service.coverImageUrl ? (
                          // Public tenant media can live on tenant-specific Blob/CDN hosts.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={service.coverImageUrl} alt={service.name} loading="lazy" />
                        ) : (
                          <div className={styles.serviceFallback}>
                            <span>{service.name.slice(0, 1).toUpperCase()}</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.serviceContent}>
                        {service.category ? <p className={styles.serviceCategory}>{service.category}</p> : null}
                        <h3 className={styles.serviceName}>{service.name}</h3>
                        <p className={styles.serviceDescription}>{service.shortDescription || service.description || companyCopy.serviceFallback}</p>
                        <div className={styles.serviceMeta}>
                          {price ? <span className={styles.servicePrice}>{price}</span> : null}
                          {service.durationMinutes ? <span><Clock3 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{service.durationMinutes} min</span> : null}
                        </div>
                      </div>

                      <div className={styles.serviceAction}>
                        <span className={styles.serviceMode}>{modeLabel}</span>
                        <span className={styles.serviceLink}>
                          {companyCopy.viewService}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyServices}>{companyCopy.noServices}</div>
            )}
          </section>
        ) : null}

        {experience.galleryEnabled && gallery.length ? (
          <section className={styles.section}>
            <p className={styles.sectionEyebrow}>{companyCopy.galleryEyebrow}</p>
            <h2 className={styles.sectionTitle}>{companyCopy.galleryTitle}</h2>
            <div className={styles.galleryGrid}>
              {gallery.map((item) =>
                item.mediaType === "video" ? (
                  <video key={item.id} src={item.publicUrl} controls muted playsInline />
                ) : (
                  // Public tenant media can live on tenant-specific Blob/CDN hosts.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={item.id} src={item.publicUrl} alt={item.altText || item.title || business.companyName} />
                ),
              )}
            </div>
          </section>
        ) : null}

        {experience.reviewsEnabled && reviews.length ? (
          <section className={styles.section}>
            <div className={styles.reviewHeader}>
              <div>
                <p className={styles.sectionEyebrow}>{companyCopy.reviewsEyebrow}</p>
                <h2 className={styles.sectionTitle}>{companyCopy.reviewsTitle}</h2>
              </div>
              <div className={styles.reviewScore}>
                <Star aria-hidden="true" />
                {(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)}
              </div>
            </div>

            <div className={styles.reviewGrid}>
              {reviews.slice(0, 6).map((review) => (
                <article key={review.id} className={styles.reviewCard}>
                  <div className={styles.stars} aria-label={`${review.rating} ${locale === "en" ? "of 5 stars" : "av 5 stjärnor"}`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} className={index < review.rating ? "fill-current" : "opacity-25"} aria-hidden="true" />
                    ))}
                  </div>
                  <p className={styles.reviewMessage}>“{review.message}”</p>
                  <p className={styles.reviewAuthor}>{review.reviewerName}{review.area ? ` · ${review.area}` : ""}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {experience.contactEnabled ? (
          <section id="kontakt" className={styles.contactSection}>
            <div className={styles.contactGrid}>
              <div>
                <p className={styles.sectionEyebrow}>{companyCopy.contactEyebrow}</p>
                <h2 className={styles.sectionTitle}>{companyCopy.contactTitle}</h2>
                <p className={styles.sectionLead}>{companyCopy.contactLead(business.companyName)}</p>
                <div className="mt-5">
                  <PublicBusinessContactForm workspaceId={business.id} locale={locale} />
                </div>
              </div>

              <aside className={styles.directContact}>
                <p className={styles.directContactTitle}>{companyCopy.directContact}</p>
                {business.contactPhone ? (
                  <PublicBusinessTrackedLink workspaceId={business.id} eventKey="contact_clicked" href={`tel:${business.contactPhone}`} className={styles.directLink}>
                    <Phone aria-hidden="true" />{business.contactPhone}
                  </PublicBusinessTrackedLink>
                ) : null}
                {business.contactEmail ? (
                  <PublicBusinessTrackedLink workspaceId={business.id} eventKey="contact_clicked" href={`mailto:${business.contactEmail}`} className={styles.directLink}>
                    <Mail aria-hidden="true" />{business.contactEmail}
                  </PublicBusinessTrackedLink>
                ) : null}
                {bookingHref ? (
                  <PublicBusinessTrackedLink workspaceId={business.id} eventKey="book_clicked" href={bookingHref} className={styles.directBook}>
                    {companyCopy.bookOnline}
                  </PublicBusinessTrackedLink>
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} {business.companyName}</span>
          <span>{companyCopy.footer}</span>
        </footer>
      </div>
    </main>
  );
}
