import Link from "next/link";
import { Languages, Navigation, ShieldCheck, Sparkles } from "lucide-react";

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
  const latitude = firstParam(params?.latitude) ?? "";
  const longitude = firstParam(params?.longitude) ?? "";
  const radius = firstParam(params?.radius) ?? "25";
  const searched = Boolean(service.trim() || location.trim() || latitude.trim() || longitude.trim());
  const t = directoryCopy[locale];
  const paths = directoryPaths[locale];
  const otherLocale: PublicLocale = locale === "sv" ? "en" : "sv";
  const searchService = normalizeDirectoryPublicServiceQuery(service, locale);

  const [locationSuggestions, search] = await Promise.all([
    getPublishedDirectoryLocationSuggestions(60),
    searched ? searchPublishedCompanyDirectory({ service: searchService, location, latitude, longitude, radiusKm: radius, limit: 30 }) : Promise.resolve(null),
  ]);
  const serviceSuggestions = DIRECTORY_SERVICES.map((item) => directoryServiceLabel(item.slug, item.label, locale));
  const nearbyActive = Boolean(search?.nearbyEnabled);

  return (
    <main lang={locale} className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-3">
          <Link href={paths.home} className="text-lg font-black tracking-tight text-brand">Proffera</Link>
          <Link href={directoryPaths[otherLocale].search} className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-black text-brand shadow-sm transition hover:border-brand/25 hover:bg-brand-soft">
            <Languages className="h-4 w-4" /> {t.language}
          </Link>
        </header>

        <section className="relative mt-6 overflow-hidden rounded-panel bg-brand-deep px-6 py-9 text-white shadow-panel sm:px-10 sm:py-12">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">{t.eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.035em] sm:text-5xl">{t.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">{t.intro}</p>
            <PublicDirectorySearchForm locale={locale} service={service} location={location} radius={radius} serviceSuggestions={serviceSuggestions} locationSuggestions={locationSuggestions} />
          </div>
        </section>

        <aside className="mt-4 rounded-card border border-line bg-surface px-4 py-3 text-sm leading-6 text-body shadow-sm">
          <div className="flex items-start gap-2">
            {nearbyActive ? <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
            <p>{nearbyActive ? t.nearbyNotice(search?.radiusKm ?? 25) : t.addressNotice}</p>
          </div>
        </aside>

        {!searched ? (
          <section className="mt-8 border-t border-line pt-8">
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

        {search?.nearbyRequested && !search.nearbyEnabled ? <div className="mt-6 rounded-card border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{t.badPosition}</div> : null}
        {search ? <PublicDirectoryResults locale={locale} search={search} /> : null}
      </div>
    </main>
  );
}
