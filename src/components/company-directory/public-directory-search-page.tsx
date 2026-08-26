import Link from "next/link";
import { Navigation, ShieldCheck, Sparkles } from "lucide-react";

import { directoryCopy, directoryPaths, directoryServiceLabel, normalizeDirectoryPublicServiceQuery, popularDirectoryServices } from "@/components/company-directory/public-directory-copy";
import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import { PublicDirectorySearchForm } from "@/components/company-directory/public-directory-search-form";
import { searchPublishedBusinessProfiles } from "@/lib/business-profile-search";
import { normalizeDirectorySearchSort } from "@/lib/company-directory-public-search";
import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";
import { getCachedPublishedDirectoryLocationSuggestions } from "@/lib/public-read-cache";
import type { PublicLocale } from "@/lib/public-locale";

type SearchParams = { service?: string | string[]; location?: string | string[]; latitude?: string | string[]; longitude?: string | string[]; radius?: string | string[]; sort?: string | string[]; page?: string | string[] };

function firstParam(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

function paginationBaseHref(path: string, params: SearchParams | undefined) {
  const query = new URLSearchParams();
  for (const key of ["service", "location", "latitude", "longitude", "radius", "sort"] as const) {
    const value = firstParam(params?.[key]);
    if (value?.trim()) query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export async function PublicDirectorySearchPage({ locale, searchParams }: { locale: PublicLocale; searchParams?: Promise<SearchParams> }) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const service = firstParam(params?.service) ?? "";
  const location = firstParam(params?.location) ?? "";
  const latitude = firstParam(params?.latitude);
  const longitude = firstParam(params?.longitude);
  const radius = firstParam(params?.radius) ?? "25";
  const requestedSort = firstParam(params?.sort) ?? "";
  const page = firstParam(params?.page) ?? "1";
  const searched = Boolean(service.trim() || location.trim() || latitude?.trim() || longitude?.trim());
  const t = directoryCopy[locale];
  const paths = directoryPaths[locale];
  const searchService = normalizeDirectoryPublicServiceQuery(service, locale);

  const [locationSuggestions, search] = await Promise.all([
    getCachedPublishedDirectoryLocationSuggestions(60),
    searched ? searchPublishedBusinessProfiles({ service: searchService, location, latitude, longitude, radiusKm: radius, sort: requestedSort, page, limit: 30 }) : Promise.resolve(null),
  ]);
  const serviceSuggestions = DIRECTORY_SERVICES.map((item) => directoryServiceLabel(item.slug, item.label, locale));
  const nearbyActive = Boolean(search?.nearbyEnabled);
  const activeSort = normalizeDirectorySearchSort(requestedSort, nearbyActive);
  const paginationHref = paginationBaseHref(paths.search, params);

  return (
    <div lang={locale} className="min-h-screen bg-canvas text-ink">
      <section className="border-b border-line bg-surface-subtle">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">{t.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">{t.intro}</p>
          </div>
          <div className="mt-5 max-w-5xl">
            <PublicDirectorySearchForm locale={locale} service={service} location={location} radius={radius} nearbyActive={nearbyActive} serviceSuggestions={serviceSuggestions} locationSuggestions={locationSuggestions} tone="light" layout="hero" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        {searched ? (
          <aside className="flex items-start gap-2 text-xs font-semibold leading-5 text-muted">
            {nearbyActive ? <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
            <p>{nearbyActive ? t.nearbyNotice(search?.radiusKm ?? 25) : t.addressNotice}</p>
          </aside>
        ) : null}

        {!searched ? (
          <section className="mt-5 border-t border-line pt-8">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              <h2 className="text-xl font-black tracking-tight">{t.popular}</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t.popularLead}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {popularDirectoryServices.map((item) => (
                <Link key={item.query} href={`${paths.search}?service=${encodeURIComponent(item.query)}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-black text-brand transition hover:border-brand/25 hover:bg-brand-soft">
                  {item[locale]}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {search?.nearbyRequested && !search.nearbyEnabled ? <div className="mt-5 rounded-card border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{t.badPosition}</div> : null}
        {search ? <PublicDirectoryResults locale={locale} search={search} sort={activeSort} paginationBaseHref={paginationHref} /> : null}
      </div>
    </div>
  );
}
