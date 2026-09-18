import Link from "next/link";
import { cookies } from "next/headers";
import { Navigation, ShieldCheck, Sparkles } from "lucide-react";

import { MarketplaceFunnelSignal } from "@/components/analytics/marketplace-funnel-signal";
import {
  directoryCopy,
  directoryPaths,
  directoryServiceLabel,
  normalizeDirectoryPublicServiceQuery,
  popularDirectoryServices,
} from "@/components/company-directory/public-directory-copy";
import { PublicDirectoryResults } from "@/components/company-directory/public-directory-results";
import { PublicDirectorySearchForm } from "@/components/company-directory/public-directory-search-form";
import { searchPublishedBusinessProfiles } from "@/lib/business-profile-search";
import { normalizeDirectorySearchSort } from "@/lib/company-directory-public-search";
import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";
import { getCachedPublishedDirectoryLocationSuggestions } from "@/lib/public-read-cache";
import type { PublicLocale } from "@/lib/public-locale";
import {
  parsePublicDirectoryNearbyValue,
  publicDirectoryNearbyCookieName,
} from "@/lib/public-directory-nearby";

import styles from "./public-directory-marketplace.module.css";

type SearchParams = {
  service?: string | string[];
  location?: string | string[];
  nearby?: string | string[];
  radius?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function resultBand(totalCount: number) {
  if (totalCount <= 0) return "none" as const;
  if (totalCount <= 5) return "1-5" as const;
  if (totalCount <= 20) return "6-20" as const;
  return "21+" as const;
}

function paginationBaseHref(path: string, params: SearchParams | undefined) {
  const query = new URLSearchParams();
  const service = firstParam(params?.service);
  const location = firstParam(params?.location);
  const radius = firstParam(params?.radius);
  const sort = firstParam(params?.sort);
  const nearbyRequested = firstParam(params?.nearby) === "1";

  if (service?.trim()) query.set("service", service);
  if (nearbyRequested) {
    query.set("nearby", "1");
    if (radius?.trim()) query.set("radius", radius);
  } else if (location?.trim()) {
    query.set("location", location);
  }
  if (sort?.trim()) query.set("sort", sort);

  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export async function PublicDirectorySearchPage({
  locale,
  searchParams,
}: {
  locale: PublicLocale;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const service = firstParam(params?.service) ?? "";
  const requestedLocation = firstParam(params?.location) ?? "";
  const nearbyRequested = firstParam(params?.nearby) === "1";
  const location = nearbyRequested ? "" : requestedLocation;
  const radius = firstParam(params?.radius) ?? "25";
  const requestedSort = firstParam(params?.sort) ?? "";
  const page = firstParam(params?.page) ?? "1";
  const searched = Boolean(service.trim() || location.trim() || nearbyRequested);
  const t = directoryCopy[locale];
  const paths = directoryPaths[locale];
  const searchService = normalizeDirectoryPublicServiceQuery(service, locale);

  const cookieStore = nearbyRequested ? await cookies() : null;
  const nearbyCoordinates = nearbyRequested
    ? parsePublicDirectoryNearbyValue(cookieStore?.get(publicDirectoryNearbyCookieName(locale))?.value)
    : null;
  const latitude = nearbyRequested ? nearbyCoordinates?.latitude ?? "" : undefined;
  const longitude = nearbyRequested ? nearbyCoordinates?.longitude ?? "" : undefined;

  const [locationSuggestions, search] = await Promise.all([
    getCachedPublishedDirectoryLocationSuggestions(60),
    searched
      ? searchPublishedBusinessProfiles({
          service: searchService,
          location,
          latitude,
          longitude,
          radiusKm: radius,
          sort: requestedSort,
          page,
          limit: 30,
        })
      : Promise.resolve(null),
  ]);

  const serviceSuggestions = DIRECTORY_SERVICES.map((item) =>
    directoryServiceLabel(item.slug, item.label, locale),
  );
  const nearbyActive = Boolean(search?.nearbyEnabled);
  const activeSort = normalizeDirectorySearchSort(requestedSort, nearbyActive);
  const paginationHref = paginationBaseHref(paths.search, params);
  const searchFormKey = `${locale}:${nearbyActive ? "nearby" : "manual"}`;
  const discoverySignalKey = search
    ? [
        locale,
        searchService.trim().toLowerCase(),
        nearbyRequested ? "nearby" : location.trim().toLowerCase(),
        nearbyRequested ? radius : "",
        activeSort,
        page,
      ].join("|")
    : "";

  return (
    <div lang={locale} className={styles.page}>
      <section className={styles.searchHero}>
        <div className={styles.searchHeroInner}>
          <div className={styles.searchIntro}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>

          <div className={styles.searchSurface}>
            <PublicDirectorySearchForm
              key={searchFormKey}
              locale={locale}
              service={service}
              location={location}
              radius={radius}
              nearbyActive={nearbyActive}
              serviceSuggestions={serviceSuggestions}
              locationSuggestions={locationSuggestions}
              tone="light"
              layout="hero"
            />
          </div>
        </div>
      </section>

      <div className={styles.resultsShell}>
        {search ? (
          <MarketplaceFunnelSignal
            dedupeKey={discoverySignalKey}
            event="marketplace_discovery_search_completed"
            properties={{ locale, result_band: resultBand(search.totalCount) }}
          />
        ) : null}

        {searched ? (
          <aside className={styles.notice}>
            {nearbyActive ? <Navigation aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            <p>{nearbyActive ? t.nearbyNotice(search?.radiusKm ?? 25) : t.addressNotice}</p>
          </aside>
        ) : null}

        {!searched ? (
          <section className={styles.popularSection}>
            <div className={styles.popularHeading}>
              <Sparkles aria-hidden="true" />
              <h2>{t.popular}</h2>
            </div>
            <p>{t.popularLead}</p>
            <div className={styles.popularLinks}>
              {popularDirectoryServices.map((item) => (
                <Link
                  key={item.query}
                  href={`${paths.search}?service=${encodeURIComponent(item.query)}`}
                >
                  {item[locale]}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {search?.nearbyRequested && !search.nearbyEnabled ? (
          <div className={styles.warning}>{t.badPosition}</div>
        ) : null}

        {search ? (
          <PublicDirectoryResults
            locale={locale}
            search={search}
            sort={activeSort}
            paginationBaseHref={paginationHref}
          />
        ) : null}
      </div>
    </div>
  );
}
