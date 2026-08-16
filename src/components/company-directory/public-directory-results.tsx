import Link from "next/link";
import { ArrowRight, MapPin, Navigation, ShieldCheck } from "lucide-react";

import { directoryCopy, directoryPaths, directoryServiceLabel } from "@/components/company-directory/public-directory-copy";
import { quoteRequestPaths } from "@/features/quote-request/localization";
import type { PublishedDirectorySearchResponse } from "@/lib/company-directory-public-search";
import type { PublicLocale } from "@/lib/public-locale";

function compactDescription(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length <= 190 ? clean : `${clean.slice(0, 187).trimEnd()}…`;
}

export function PublicDirectoryResults({ locale, search }: { locale: PublicLocale; search: PublishedDirectorySearchResponse }) {
  const t = directoryCopy[locale];
  const nearbyActive = search.nearbyEnabled;
  const profileBase = directoryPaths[locale].search;

  if (!search.serviceResolved) {
    return <div className="mt-6 rounded-card border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{t.badService}</div>;
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{t.results}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">{t.companyCount(search.results.length)}</h2>
        </div>
        <p className="text-xs font-semibold text-muted">{nearbyActive ? t.nearest(search.radiusKm) : t.publishedOnly}</p>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-panel bg-brand-deep p-5 text-white shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-black">{locale === "en" ? "Want to compare quotes?" : "Vill du jämföra offerter?"}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">{locale === "en" ? "Send one request and let Proffera match it with suitable companies." : "Skicka en förfrågan så kan Proffera matcha den med lämpliga företag."}</p>
        </div>
        <Link href={quoteRequestPaths[locale]} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-white px-4 text-sm font-black text-brand-deep transition hover:bg-brand-soft">
          {locale === "en" ? "Get quotes" : "Få offerter"}<ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3">
        {search.results.map((result) => (
          <article key={result.id} className="group min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-card">
            <div className="grid min-w-0 sm:grid-cols-[5px_minmax(0,1fr)_auto]">
              <div className="hidden bg-brand sm:block" aria-hidden="true" />
              <div className="min-w-0 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand">{directoryServiceLabel(result.matchedServiceSlug, result.matchedServiceLabel, locale)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold text-body"><ShieldCheck className="h-3.5 w-3.5" /> {t.officialData}</span>
                  {result.distanceKm !== null ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800"><Navigation className="h-3.5 w-3.5" /> {t.away(result.distanceKm)}</span> : null}
                </div>
                <h3 className="mt-3 break-words text-xl font-black tracking-tight text-ink sm:text-2xl">{result.companyName}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-body"><MapPin className="h-4 w-4 shrink-0 text-brand" /> {[result.postalCode, result.city].filter(Boolean).join(" ") || result.municipality || t.country}</p>
                {result.activityDescription ? <div className="mt-4 max-w-3xl">{locale === "en" ? <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-muted">{t.sourceDescription}</p> : null}<p lang="sv" className="break-words text-sm leading-6 text-muted">{compactDescription(result.activityDescription)}</p></div> : null}
              </div>
              <div className="flex items-end p-5 pt-0 sm:items-center sm:p-6 sm:pl-2">
                <Link href={`${profileBase}/${encodeURIComponent(result.slug)}`} className="directory-profile-result-cta inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-control border border-brand px-4 text-sm font-black text-brand transition group-hover:bg-brand group-hover:text-white sm:w-auto">
                  {t.viewProfile}<ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </article>
        ))}
        {search.results.length === 0 ? <div className="rounded-card border border-line bg-surface p-6 text-sm leading-6 text-muted shadow-sm">{nearbyActive ? t.emptyNearby(search.radiusKm) : t.empty}</div> : null}
      </div>
    </section>
  );
}
