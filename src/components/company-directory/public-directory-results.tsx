import Link from "next/link";
import { ArrowRight, CalendarCheck2, FileText, Mail, MapPin, Navigation, ShieldCheck } from "lucide-react";

import { directoryCopy, directoryPaths, directoryServiceLabel } from "@/components/company-directory/public-directory-copy";
import { quoteRequestPaths } from "@/features/quote-request/localization";
import type { PublishedDirectorySearchResponse, PublishedDirectorySearchResult } from "@/lib/company-directory-public-search";
import type { PublicLocale } from "@/lib/public-locale";

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

export function PublicDirectoryResults({ locale, search }: { locale: PublicLocale; search: PublishedDirectorySearchResponse }) {
  const t = directoryCopy[locale];
  const nearbyActive = search.nearbyEnabled;
  const profileBase = directoryPaths[locale].search;

  if (!search.serviceResolved) {
    return <div className="mt-5 rounded-card border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{t.badService}</div>;
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">{t.results}</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-ink sm:text-3xl">{t.companyCount(search.results.length)}</h2>
          <p className="mt-1 text-xs font-semibold text-muted">{t.publishedOnly}</p>
        </div>
        {nearbyActive ? <p className="inline-flex items-center gap-1.5 text-xs font-bold text-muted"><Navigation className="h-4 w-4 text-brand" />{t.nearest(search.radiusKm)}</p> : null}
      </div>

      <div className="mt-4 grid gap-3">
        {search.results.map((result) => {
          const marketplace = marketplaceLinks(result, locale);
          const canQuote = result.conversionMode === "quote" || result.conversionMode === "book_or_quote";
          const canContact = result.conversionMode === "contact";
          const hasPrimaryMarketplaceAction = Boolean(marketplace?.bookingHref || canQuote || canContact);

          return (
            <article key={result.id} className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-brand/25 hover:shadow-card sm:p-5">
              <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_160px] md:items-center lg:grid-cols-[minmax(0,1fr)_180px]">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-black tracking-[-0.02em] text-ink sm:text-xl">{result.companyName}</h3>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">{directoryServiceLabel(result.matchedServiceSlug, result.matchedServiceLabel, locale)}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-3 py-1 text-xs font-bold text-body"><ShieldCheck className="h-3.5 w-3.5 text-brand" /> {t.verifiedDetails}</span>
                    {marketplace ? <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-black text-brand">{t.profferaBusiness}</span> : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-body">
                    <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-brand" />{registeredLocation(result, locale)}</span>
                    {result.distanceKm !== null ? <span className="inline-flex items-center gap-1.5 font-semibold text-muted"><Navigation className="h-4 w-4 text-brand" />{t.away(result.distanceKm)}</span> : null}
                    {result.servesNearbyLocation ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand"><ShieldCheck className="h-3.5 w-3.5" />{t.serviceAreaMatch}</span> : null}
                  </div>
                </div>

                <div className="grid w-full gap-2">
                  {marketplace ? (
                    <>
                      {marketplace.bookingHref ? <Link href={marketplace.bookingHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong"><CalendarCheck2 className="mr-2 h-4 w-4" />{t.book}</Link> : null}
                      {canQuote ? <Link href={marketplace.quoteHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong"><FileText className="mr-2 h-4 w-4" />{t.requestQuote}</Link> : null}
                      {canContact ? <Link href={marketplace.contactHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong"><Mail className="mr-2 h-4 w-4" />{t.contact}</Link> : null}
                      {!hasPrimaryMarketplaceAction ? <Link href={marketplace.serviceHref} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-strong">{t.viewService}<ArrowRight className="ml-2 h-4 w-4" /></Link> : null}
                      <Link href={marketplace.companyHref} className="inline-flex min-h-9 items-center justify-center rounded-control border border-line bg-surface px-3 text-xs font-black text-brand transition hover:border-brand/25 hover:bg-brand-soft">{t.viewCompany}</Link>
                    </>
                  ) : (
                    <Link href={`${profileBase}/${encodeURIComponent(result.slug)}`} className="directory-profile-result-cta inline-flex min-h-10 w-full items-center justify-center rounded-control border border-brand/30 bg-surface px-4 text-sm font-black text-brand transition hover:bg-brand-soft">
                      {t.viewProfile}<ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {search.results.length === 0 ? <div className="rounded-2xl border border-line bg-surface p-5 text-sm leading-6 text-muted shadow-sm">{nearbyActive ? t.emptyNearby(search.radiusKm) : t.empty}</div> : null}
      </div>

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
