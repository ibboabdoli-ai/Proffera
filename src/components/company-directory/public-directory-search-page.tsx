import Link from "next/link";
import { Navigation, ShieldCheck, Sparkles } from "lucide-react";

import { directoryCopy, directoryPaths, directoryServiceLabel, normalizeDirectoryPublicServiceQuery, popularDirectoryServices } from "@/components/company-directory/public-directory-copy";
import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import { PublicDirectorySearchForm } from "@/components/company-directory/public-directory-search-form";
import { getPublishedDirectoryLocationSuggestions, searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";
import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";
import type { PublicLocale } from "@/lib/public-locale";

type SearchParams = { service?: string | string[]; location?: string | string[]; latitude?: string | string[]; longitude?: string | string[]; radius?: string | string[] };

function firstParam(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

export async function PublicDirectorySearchPage({ locale, searchParams }: { locale: PublicLocale; searchParams?: Promise<SearchParams> }) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const service = firstParam(params?.service) ?? "";
  const location = firstParam(params?.location) ?? "";
  const latitude = firstParam(params?.latitude);
  const longitude = firstParam(params?.longitude);
  const radius = firstParam(params?.radius) ?? "25";
  const searched = Boolean(service.trim() || location.trim() || latitude?.trim() || longitude?.trim());
  const t = directoryCopy[locale];
  const paths = directoryPaths[locale];
  const searchService = normalizeDirectoryPublicServiceQuery(service, locale);

  const [locationSuggestions, search] = await Promise.all([
    getPublishedDirectoryLocationSuggestions(60),
    searched ? searchPublishedCompanyDirectory({ service: searchService, location, latitude, longitude, radiusKm: radius, limit: 30 }) : Promise.resolve(null),
  ]);
  const serviceSuggestions = DIRECTORY_SERVICES.map((item) => directoryServiceLabel(item.slug, item.label, locale));
  const nearbyActive = Boolean(search?.nearbyEnabled);

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
        {search ? <PublicDirectoryResults locale={locale} search={search} /> : null}
      </div>
    </div>
  );
}
