import Link from "next/link";
import { ArrowRight, CalendarCheck2, ChevronLeft, ChevronRight, FileText, Mail, MapPin, Navigation, ShieldCheck, Star } from "lucide-react";

import { directoryCopy, directoryPaths, directoryServiceLabel, popularDirectoryServices } from "@/components/company-directory/public-directory-copy";
import { PublicDirectorySortControls } from "@/components/company-directory/public-directory-sort-controls";
import { quoteRequestPaths } from "@/features/quote-request/localization";
import type { SearchCardBusinessProjection } from "@/lib/business-profile-policy";
import type { DirectorySearchSort, PublishedDirectorySearchResponse, PublishedDirectorySearchResult } from "@/lib/company-directory-public-search";
import type { PublicLocale } from "@/lib/public-locale";

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
      <section className="mt-5 rounded-card border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <h2 className="font-black">{t.tryPopular}</h2>
        <p className="mt-1 text-sm leading-6">{t.badService}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {popularDirectoryServices.slice(0, 5).map((item) => (
            <Link key={item.query} href={withServiceHref(paginationBaseHref, item.query)} className="rounded-full border border-amber-300 bg-white px-3 py-2 text-sm font-black text-brand transition hover:bg-brand-soft">
              {item[locale]}
            </Link>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={profileBase} className="inline-flex min-h-10 items-center justify-center rounded-control border border-amber-300 bg-white px-4 text-sm font-black text-brand transition hover:bg-brand-soft">{t.browseAll}</Link>
          <Link href={quoteRequestPaths[locale]} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong">{t.getQuotes}<ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">{t.results}</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-ink sm:text-3xl">{t.companyCount(search.totalCount)}</h2>
          <p className="mt-1 text-xs font-semibold text-muted">{t.publishedOnly}</p>
          {search.totalCount > 0 ? <p className="mt-1 text-xs font-bold text-body">{t.range(from, to, search.totalCount)}</p> : null}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {nearbyActive ? <p className="inline-flex items-center gap-1.5 text-xs font-bold text-muted"><Navigation className="h-4 w-4 text-brand" />{sort === "name" ? t.withinRadius(search.radiusKm) : t.nearest(search.radiusKm)}</p> : null}
          {search.totalCount > 0 ? <PublicDirectorySortControls locale={locale} sort={sort} nearbyActive={nearbyActive} baseHref={paginationBaseHref} /> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {search.results.map((result) => {
          const marketplace = marketplaceLinks(result, locale);
          const canQuote = result.conversionMode === "quote" || result.conversionMode === "book_or_quote";
          const canContact = result.conversionMode === "contact";
          const hasPrimaryMarketplaceAction = Boolean(marketplace?.bookingHref || canQuote || canContact);
          const profileMedia = result.profile?.media;
          const cardMedia = profileMedia
            && profileMedia.role !== "illustration"
            && (profileMedia.kind === "image" || profileMedia.kind === "photo" || profileMedia.kind === "logo")
            ? profileMedia
            : null;
          const reputation = result.profile?.reputation && result.profile.reputation.verifiedReviews > 0
            ? result.profile.reputation
            : null;

          return (
            <article key={result.id} className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-brand/25 hover:shadow-card sm:p-5">
              <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_160px] md:items-center lg:grid-cols-[minmax(0,1fr)_180px]">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  {cardMedia ? (
                    <div data-search-card-media className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-subtle sm:h-24 sm:w-24">
                      {/* Search-card media may use tenant-specific Blob hosts, so keep the original public URL without image rewriting. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cardMedia.url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    </div>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-lg font-black tracking-[-0.02em] text-ink sm:text-xl">{result.companyName}</h3>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">{directoryServiceLabel(result.matchedServiceSlug, result.matchedServiceLabel, locale)}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-3 py-1 text-xs font-bold text-body"><ShieldCheck className="h-3.5 w-3.5 text-brand" /> {t.verifiedDetails}</span>
                      {marketplace ? <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-black text-brand">{t.profferaBusiness}</span> : null}
                    </div>

                    {reputation ? (
                      <div data-search-card-reputation className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs font-bold text-body">
                        <Star className="h-4 w-4 fill-current text-brand" aria-hidden="true" />
                        <span className="font-black text-ink">{reputation.rating.toFixed(1)}</span>
                        <span className="text-muted">· {verifiedReviewsLabel(reputation.verifiedReviews, locale)}</span>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-body">
                      <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-brand" />{registeredLocation(result, locale)}</span>
                      {result.distanceKm !== null ? <span className="inline-flex items-center gap-1.5 font-semibold text-muted"><Navigation className="h-4 w-4 text-brand" />{t.away(result.distanceKm)}</span> : null}
                      {result.servesNearbyLocation ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand"><ShieldCheck className="h-3.5 w-3.5" />{t.serviceAreaMatch}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="grid w-full gap-2">
                  {marketplace ? (
                    <>
                      {marketplace.bookingHref ? <Link data-marketplace-action="book" href={marketplace.bookingHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong"><CalendarCheck2 className="mr-2 h-4 w-4" />{t.book}</Link> : null}
                      {canQuote ? <Link data-marketplace-action="quote" href={marketplace.quoteHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong"><FileText className="mr-2 h-4 w-4" />{t.requestQuote}</Link> : null}
                      {canContact ? <Link data-marketplace-action="contact" href={marketplace.contactHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong"><Mail className="mr-2 h-4 w-4" />{t.contact}</Link> : null}
                      {!hasPrimaryMarketplaceAction ? <Link data-marketplace-action="service" href={marketplace.serviceHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong">{t.viewService}<ArrowRight className="ml-2 h-4 w-4" /></Link> : null}
                      <Link data-marketplace-action="company" href={marketplace.companyHref} className="inline-flex min-h-9 items-center justify-center rounded-control border border-line bg-surface px-3 text-xs font-black text-brand transition hover:border-brand/25 hover:bg-brand-soft">{t.viewCompany}</Link>
                    </>
                  ) : (
                    <Link data-marketplace-action="directory-profile" href={`${profileBase}/${encodeURIComponent(result.slug)}`} className="directory-profile-result-cta inline-flex min-h-10 w-full items-center justify-center rounded-control border border-brand/30 bg-surface px-4 text-sm font-black text-brand transition hover:bg-brand-soft">
                      {t.viewProfile}<ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {search.results.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-black text-ink">{t.alternativeTitle}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{nearbyActive ? t.emptyNearby(search.radiusKm) : t.empty}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{t.alternativeLead}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {canSearchAllSweden(paginationBaseHref) ? (
                <Link href={withoutLocationHref(paginationBaseHref)} className="inline-flex min-h-10 items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-black text-brand transition hover:bg-brand-soft">
                  {t.searchAllSweden}
                </Link>
              ) : null}
              <Link href={quoteRequestPaths[locale]} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong">
                {t.getQuotes}<ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {search.totalPages > 1 ? (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label={t.pagination}>
          {search.page > 1 ? (
            <Link href={pageHref(paginationBaseHref, search.page - 1)} className="inline-flex min-h-10 items-center justify-center rounded-control border border-line bg-surface px-3 text-sm font-black text-brand transition hover:bg-brand-soft">
              <ChevronLeft className="mr-1 h-4 w-4" />{t.previous}
            </Link>
          ) : null}
          {pages.map((page, index) => {
            const previousPage = pages[index - 1];
            const showGap = previousPage !== undefined && page - previousPage > 1;
            return (
              <span key={page} className="contents">
                {showGap ? <span className="px-1 text-sm font-bold text-muted" aria-hidden="true">…</span> : null}
                {page === search.page ? (
                  <span aria-current="page" aria-label={t.pageLabel(page)} className="inline-flex h-10 min-w-10 items-center justify-center rounded-control bg-brand px-3 text-sm font-black text-white">{page}</span>
                ) : (
                  <Link aria-label={t.pageLabel(page)} href={pageHref(paginationBaseHref, page)} className="inline-flex h-10 min-w-10 items-center justify-center rounded-control border border-line bg-surface px-3 text-sm font-black text-brand transition hover:bg-brand-soft">{page}</Link>
                )}
              </span>
            );
          })}
          {search.page < search.totalPages ? (
            <Link href={pageHref(paginationBaseHref, search.page + 1)} className="inline-flex min-h-10 items-center justify-center rounded-control border border-line bg-surface px-3 text-sm font-black text-brand transition hover:bg-brand-soft">
              {t.next}<ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          ) : null}
        </nav>
      ) : null}

      {search.results.length > 0 ? (
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-brand/15 bg-brand-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-ink">{t.compareQuotes}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{t.compareQuotesLead}</p>
          </div>
          <Link href={quoteRequestPaths[locale]} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong">
            {t.getQuotes}<ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
