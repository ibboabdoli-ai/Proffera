import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Mail,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
} from "lucide-react";

import {
  directoryCopy,
  directoryPaths,
  directoryServiceLabel,
  popularDirectoryServices,
} from "@/components/company-directory/public-directory-copy";
import {
  MarketplaceCompanyCover,
  MarketplaceCompanyLogo,
} from "@/components/marketplace/marketplace-company-media";
import { PublicDirectorySortControls } from "@/components/company-directory/public-directory-sort-controls";
import { quoteRequestPaths } from "@/features/quote-request/localization";
import type { SearchCardBusinessProjection } from "@/lib/business-profile-policy";
import type {
  DirectorySearchSort,
  PublishedDirectorySearchResponse,
  PublishedDirectorySearchResult,
} from "@/lib/company-directory-public-search";
import type { PublicLocale } from "@/lib/public-locale";

import styles from "./public-directory-marketplace.module.css";

type PublicDirectorySearchCardResult = PublishedDirectorySearchResult & {
  profile?: SearchCardBusinessProjection;
};

type PublicDirectorySearchCardResponse = Omit<PublishedDirectorySearchResponse, "results"> & {
  results: PublicDirectorySearchCardResult[];
};

function withWorkspaceLocale(path: string, locale: PublicLocale) {
  return locale === "en" ? `${path}?lang=en` : path;
}

function marketplaceLinks(result: PublishedDirectorySearchResult, locale: PublicLocale) {
  if (!result.claimedWorkspaceSlug || !result.claimedServiceSlug || !result.claimedServiceId) return null;

  const workspaceSlug = encodeURIComponent(result.claimedWorkspaceSlug);
  const serviceSlug = encodeURIComponent(result.claimedServiceSlug);
  const companyHref = withWorkspaceLocale(`/foretag/${workspaceSlug}`, locale);
  const serviceHref = withWorkspaceLocale(`/foretag/${workspaceSlug}/tjanster/${serviceSlug}`, locale);
  const quoteHref = `${serviceHref}#offert`;
  const contactHref = `${serviceHref}#kontaktforfragan`;
  let bookingHref = "";

  if (result.bookingAvailable && result.claimedBookingSlug) {
    const query = new URLSearchParams({ service_id: result.claimedServiceId });
    if (locale === "en") query.set("lang", "en");
    bookingHref = `/boka/${encodeURIComponent(result.claimedBookingSlug)}?${query.toString()}`;
  }

  return { companyHref, serviceHref, quoteHref, contactHref, bookingHref };
}

function registeredLocation(result: PublishedDirectorySearchResult, locale: PublicLocale) {
  const t = directoryCopy[locale];
  const place = result.city || result.municipality || t.country;
  return t.registeredIn(place);
}

function verifiedReviewsLabel(count: number, locale: PublicLocale) {
  const formatted = new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en").format(count);
  if (locale === "en") return `${formatted} verified ${count === 1 ? "review" : "reviews"}`;
  return `${formatted} ${count === 1 ? "verifierat omdöme" : "verifierade omdömen"}`;
}

function pageHref(baseHref: string, page: number) {
  const url = new URL(baseHref, "https://proffera.invalid");
  if (page <= 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(page));
  return `${url.pathname}${url.search}`;
}

function withoutLocationHref(baseHref: string) {
  const url = new URL(baseHref, "https://proffera.invalid");
  for (const key of ["location", "nearby", "radius", "page"]) {
    url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}`;
}

function withServiceHref(baseHref: string, service: string) {
  const url = new URL(baseHref, "https://proffera.invalid");
  url.searchParams.set("service", service);
  url.searchParams.delete("page");
  return `${url.pathname}${url.search}`;
}

function hasLocationConstraint(baseHref: string) {
  const url = new URL(baseHref, "https://proffera.invalid");
  return Boolean(url.searchParams.get("location")?.trim()) || url.searchParams.get("nearby") === "1";
}

function canSearchAllSweden(baseHref: string) {
  const url = new URL(baseHref, "https://proffera.invalid");
  return hasLocationConstraint(baseHref) && Boolean(url.searchParams.get("service")?.trim());
}

function paginationPages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  return [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export function PublicDirectoryResults({
  locale,
  search,
  sort = "recommended",
  paginationBaseHref = directoryPaths[locale].search,
}: {
  locale: PublicLocale;
  search: PublicDirectorySearchCardResponse;
  sort?: DirectorySearchSort;
  paginationBaseHref?: string;
}) {
  const t = directoryCopy[locale];
  const nearbyActive = search.nearbyEnabled;
  const profileBase = directoryPaths[locale].search;
  const from = search.totalCount > 0 ? (search.page - 1) * search.pageSize + 1 : 0;
  const to = search.totalCount > 0 ? Math.min(search.page * search.pageSize, search.totalCount) : 0;
  const pages = paginationPages(search.page, search.totalPages);

  if (!search.serviceResolved) {
    return (
      <section className={styles.invalidState}>
        <h2>{t.tryPopular}</h2>
        <p>{t.badService}</p>
        <div className={styles.popularLinks}>
          {popularDirectoryServices.slice(0, 5).map((item) => (
            <Link key={item.query} href={withServiceHref(paginationBaseHref, item.query)}>
              {item[locale]}
            </Link>
          ))}
        </div>
        <div className={styles.invalidActions}>
          <Link href={profileBase} className={styles.secondaryAction}>{t.browseAll}</Link>
          <Link href={quoteRequestPaths[locale]} className={styles.primaryAction}>
            {t.getQuotes}<ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.resultsSection}>
      <div className={styles.resultsToolbar}>
        <div className={styles.resultsMeta}>
          <p className={styles.eyebrow}>{t.results}</p>
          <h2>{t.companyCount(search.totalCount)}</h2>
          <div className={styles.resultsMetaSecondary}>
            <span>{t.publishedOnly}</span>
            {search.totalCount > 0 ? <span>{t.range(from, to, search.totalCount)}</span> : null}
          </div>
        </div>

        <div className={styles.sortArea}>
          {nearbyActive ? (
            <p className={styles.nearbyLabel}>
              <Navigation aria-hidden="true" />
              {sort === "name" ? t.withinRadius(search.radiusKm) : t.nearest(search.radiusKm)}
            </p>
          ) : null}
          {search.totalCount > 0 ? (
            <PublicDirectorySortControls
              locale={locale}
              sort={sort}
              nearbyActive={nearbyActive}
              baseHref={paginationBaseHref}
            />
          ) : null}
        </div>
      </div>

      <div className={styles.resultList}>
        {search.results.map((result) => {
          const marketplace = marketplaceLinks(result, locale);
          const canQuote = result.conversionMode === "quote" || result.conversionMode === "book_or_quote";
          const canContact = result.conversionMode === "contact";
          const hasPrimaryMarketplaceAction = Boolean(marketplace?.bookingHref || canQuote || canContact);
          const profileMedia = result.profile?.media;
          const coverMedia = profileMedia && profileMedia.role !== "logo" ? profileMedia : null;
          const logoUrl = result.profile?.logoUrl || (profileMedia?.role === "logo" ? profileMedia.url : "");
          const reputation = result.profile?.reputation && result.profile.reputation.verifiedReviews > 0
            ? result.profile.reputation
            : null;

          return (
            <article key={result.id} className={`group ${styles.resultCard}`}>
              <div className={styles.resultVisual}>
                <MarketplaceCompanyCover
                  name={result.companyName}
                  url={coverMedia?.url}
                  illustration={coverMedia?.role === "illustration"}
                />
                <span className={styles.logoFloat}>
                  <MarketplaceCompanyLogo name={result.companyName} url={logoUrl} size="sm" />
                </span>
                {coverMedia?.role === "illustration" ? (
                  <span className={styles.illustrationBadge}>
                    {locale === "en" ? "Illustration" : "Illustrationsbild"}
                  </span>
                ) : null}
              </div>

              <div className={styles.resultContent}>
                <div className={styles.resultTitleRow}>
                  <h3>{result.companyName}</h3>
                  <div className={styles.badges}>
                    <span className={styles.badge}>
                      <BadgeCheck aria-hidden="true" />
                      {t.verifiedDetails}
                    </span>
                    {marketplace ? (
                      <span className={styles.activeBadge}>
                        <ShieldCheck aria-hidden="true" />
                        {t.profferaBusiness}
                      </span>
                    ) : null}
                  </div>
                </div>

                {reputation ? (
                  <div data-search-card-reputation className={styles.reputation}>
                    <Star aria-hidden="true" />
                    <strong>{reputation.rating.toFixed(1)}</strong>
                    <span>· {verifiedReviewsLabel(reputation.verifiedReviews, locale)}</span>
                  </div>
                ) : null}

                <div className={styles.locationRow}>
                  <span>
                    <MapPin aria-hidden="true" />
                    {registeredLocation(result, locale)}
                  </span>
                  {result.distanceKm !== null ? (
                    <span>
                      <Navigation aria-hidden="true" />
                      {t.away(result.distanceKm)}
                    </span>
                  ) : null}
                  {result.servesNearbyLocation ? (
                    <span>
                      <ShieldCheck aria-hidden="true" />
                      {t.serviceAreaMatch}
                    </span>
                  ) : null}
                </div>

                <div className={styles.serviceTags}>
                  <span>{directoryServiceLabel(result.matchedServiceSlug, result.matchedServiceLabel, locale)}</span>
                </div>
              </div>

              <div className={styles.actionStack}>
                {marketplace ? (
                  <>
                    {marketplace.bookingHref ? (
                      <Link
                        data-marketplace-action="book"
                        href={marketplace.bookingHref}
                        className={styles.primaryAction}
                      >
                        <CalendarCheck2 aria-hidden="true" />{t.book}
                      </Link>
                    ) : null}
                    {canQuote ? (
                      <Link
                        data-marketplace-action="quote"
                        href={marketplace.quoteHref}
                        className={styles.primaryAction}
                      >
                        <FileText aria-hidden="true" />{t.requestQuote}
                      </Link>
                    ) : null}
                    {canContact ? (
                      <Link
                        data-marketplace-action="contact"
                        href={marketplace.contactHref}
                        className={styles.primaryAction}
                      >
                        <Mail aria-hidden="true" />{t.contact}
                      </Link>
                    ) : null}
                    {!hasPrimaryMarketplaceAction ? (
                      <Link
                        data-marketplace-action="service"
                        href={marketplace.serviceHref}
                        className={styles.primaryAction}
                      >
                        {t.viewService}<ArrowRight aria-hidden="true" />
                      </Link>
                    ) : null}
                    <Link
                      data-marketplace-action="company"
                      href={marketplace.companyHref}
                      className={styles.secondaryAction}
                    >
                      {t.viewCompany}
                    </Link>
                  </>
                ) : (
                  <Link
                    data-marketplace-action="directory-profile"
                    href={`${profileBase}/${encodeURIComponent(result.slug)}`}
                    className={styles.directoryAction}
                  >
                    {t.viewProfile}<ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </div>
            </article>
          );
        })}

        {search.results.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>{t.alternativeTitle}</h3>
            <p>{nearbyActive ? t.emptyNearby(search.radiusKm) : t.empty}</p>
            <p>{t.alternativeLead}</p>
            <div className={styles.emptyActions}>
              {canSearchAllSweden(paginationBaseHref) ? (
                <Link href={withoutLocationHref(paginationBaseHref)} className={styles.secondaryAction}>
                  {t.searchAllSweden}
                </Link>
              ) : null}
              <Link href={quoteRequestPaths[locale]} className={styles.primaryAction}>
                {t.getQuotes}<ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {search.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label={t.pagination}>
          {search.page > 1 ? (
            <Link href={pageHref(paginationBaseHref, search.page - 1)} className={styles.pageLink}>
              <ChevronLeft aria-hidden="true" />{t.previous}
            </Link>
          ) : null}
          {pages.map((page, index) => {
            const previousPage = pages[index - 1];
            const showGap = previousPage !== undefined && page - previousPage > 1;
            return (
              <span key={page} className="contents">
                {showGap ? <span className="px-1 text-sm font-bold text-[#617085]" aria-hidden="true">…</span> : null}
                {page === search.page ? (
                  <span
                    aria-current="page"
                    aria-label={t.pageLabel(page)}
                    className={styles.currentPage}
                  >
                    {page}
                  </span>
                ) : (
                  <Link
                    aria-label={t.pageLabel(page)}
                    href={pageHref(paginationBaseHref, page)}
                    className={styles.pageLink}
                  >
                    {page}
                  </Link>
                )}
              </span>
            );
          })}
          {search.page < search.totalPages ? (
            <Link href={pageHref(paginationBaseHref, search.page + 1)} className={styles.pageLink}>
              {t.next}<ChevronRight aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      ) : null}

      {search.results.length > 0 ? (
        <div className={styles.quoteCallout}>
          <div>
            <strong>{t.compareQuotes}</strong>
            <p>{t.compareQuotesLead}</p>
          </div>
          <Link href={quoteRequestPaths[locale]} className={styles.primaryAction}>
            {t.getQuotes}<ArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
