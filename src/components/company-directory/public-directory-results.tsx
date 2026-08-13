import Link from "next/link";
import { ArrowRight, MapPin, Navigation, ShieldCheck } from "lucide-react";

import { directoryCopy, directoryPaths, directoryServiceLabel } from "@/components/company-directory/public-directory-copy";
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
    return <div className="mt-6 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">{t.badService}</div>;
  }

  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#647067]">{t.results}</p>
          <h2 className="mt-1 text-2xl font-black">{t.companyCount(search.results.length)}</h2>
        </div>
        <p className="text-xs font-semibold text-[#758078]">{nearbyActive ? t.nearest(search.radiusKm) : t.publishedOnly}</p>
      </div>

      <div className="mt-4 grid gap-3">
        {search.results.map((result) => (
          <article key={result.id} className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-black/5 transition hover:shadow-sm sm:p-6">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#e8f2ec] px-3 py-1 text-xs font-black text-[#173e2b]">{directoryServiceLabel(result.matchedServiceSlug, result.matchedServiceLabel, locale)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f2] px-3 py-1 text-xs font-bold text-[#536057]"><ShieldCheck className="h-3.5 w-3.5" /> {t.officialData}</span>
                  {result.distanceKm !== null ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-black text-[#315687]"><Navigation className="h-3.5 w-3.5" /> {t.away(result.distanceKm)}</span> : null}
                </div>
                <h3 className="mt-3 break-words text-xl font-black">{result.companyName}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#5f6a62]"><MapPin className="h-4 w-4 shrink-0" /> {[result.postalCode, result.city].filter(Boolean).join(" ") || result.municipality || t.country}</p>
                {result.activityDescription ? <div className="mt-3 max-w-3xl">{locale === "en" ? <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-[#7a847d]">{t.sourceDescription}</p> : null}<p lang="sv" className="break-words text-sm leading-6 text-[#69736c]">{compactDescription(result.activityDescription)}</p></div> : null}
              </div>
              <Link href={`${profileBase}/${encodeURIComponent(result.slug)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#173e2b] px-4 text-sm font-black text-[#173e2b] transition hover:bg-[#173e2b] hover:text-white">{t.viewProfile}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </div>
          </article>
        ))}
        {search.results.length === 0 ? <div className="rounded-2xl bg-white p-6 text-sm leading-6 text-[#68736b] ring-1 ring-black/5">{nearbyActive ? t.emptyNearby(search.radiusKm) : t.empty}</div> : null}
      </div>
    </section>
  );
}
