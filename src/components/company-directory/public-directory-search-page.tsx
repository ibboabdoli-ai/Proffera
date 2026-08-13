import Link from "next/link";
import { Languages, Navigation, ShieldCheck, Sparkles } from "lucide-react";

import { directoryCopy, directoryPaths, directoryServiceLabel, popularDirectoryServices } from "@/components/company-directory/public-directory-copy";
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

  const [locationSuggestions, search] = await Promise.all([
    getPublishedDirectoryLocationSuggestions(60),
    searched ? searchPublishedCompanyDirectory({ service, location, latitude, longitude, radiusKm: radius, limit: 30 }) : Promise.resolve(null),
  ]);
  const serviceSuggestions = DIRECTORY_SERVICES.map((item) => directoryServiceLabel(item.slug, item.label, locale));
  const nearbyActive = Boolean(search?.nearbyEnabled);

  return (
    <main lang={locale} className="min-h-screen bg-[#f6f7f5] px-4 py-6 text-[#17201a] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-3">
          <Link href={paths.home} className="text-lg font-black text-[#173e2b]">Proffera</Link>
          <Link href={directoryPaths[otherLocale].search} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#173e2b]/15 bg-white px-3 text-sm font-black text-[#173e2b]"><Languages className="h-4 w-4" /> {t.language}</Link>
        </header>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#102a1c] px-6 py-7 text-white shadow-sm sm:px-9 sm:py-9">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a9dbb9]">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">{t.intro}</p>
          <PublicDirectorySearchForm locale={locale} service={service} location={location} radius={radius} serviceSuggestions={serviceSuggestions} locationSuggestions={locationSuggestions} />
        </section>

        <aside className="mt-4 rounded-2xl border border-[#d7e4da] bg-[#f2f8f4] px-4 py-3 text-sm leading-6 text-[#465349]">
          <div className="flex items-start gap-2">{nearbyActive ? <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#173e2b]" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#173e2b]" />}<p>{nearbyActive ? t.nearbyNotice(search?.radiusKm ?? 25) : t.addressNotice}</p></div>
        </aside>

        {!searched ? <section className="mt-7 rounded-2xl bg-white p-6 ring-1 ring-black/5 sm:p-7"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#173e2b]" /><h2 className="text-xl font-black">{t.popular}</h2></div><p className="mt-2 text-sm leading-6 text-[#667168]">{t.popularLead}</p><div className="mt-5 flex flex-wrap gap-2">{popularDirectoryServices.map((item) => <Link key={item.query} href={`${paths.search}?service=${encodeURIComponent(item.query)}`} className="rounded-full border border-[#173e2b]/15 bg-[#f2f8f4] px-4 py-2 text-sm font-black text-[#173e2b] transition hover:border-[#173e2b]/35 hover:bg-[#e9f3ec]">{item[locale]}</Link>)}</div></section> : null}

        {search?.nearbyRequested && !search.nearbyEnabled ? <div className="mt-6 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">{t.badPosition}</div> : null}
        {search ? <PublicDirectoryResults locale={locale} search={search} /> : null}
      </div>
    </main>
  );
}
