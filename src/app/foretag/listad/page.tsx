import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Navigation, ShieldCheck, Sparkles } from "lucide-react";

import { PublicDirectorySearchForm } from "@/app/foretag/listad/PublicDirectorySearchForm";
import {
  getPublishedDirectoryLocationSuggestions,
  searchPublishedCompanyDirectory,
} from "@/lib/company-directory-public-search";
import { DIRECTORY_SERVICES } from "@/lib/company-directory-service-taxonomy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hitta företag | Proffera",
  description: "Sök publicerade företag på Proffera efter tjänst och ort.",
  robots: { index: false, follow: true },
};

type PageProps = {
  searchParams?: Promise<{
    service?: string | string[];
    location?: string | string[];
    latitude?: string | string[];
    longitude?: string | string[];
    radius?: string | string[];
  }>;
};

const popularServices = [
  "Rörmokare",
  "Elektriker",
  "Städning",
  "Fönsterputsning",
  "Målare",
  "Snickare",
  "Flytthjälp",
  "Trädgård",
] as const;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function compactDescription(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= 190) return clean;
  return `${clean.slice(0, 187).trimEnd()}…`;
}

export default async function ListedDirectorySearchPage({ searchParams }: PageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const service = firstParam(params?.service) ?? "";
  const location = firstParam(params?.location) ?? "";
  const latitude = firstParam(params?.latitude) ?? "";
  const longitude = firstParam(params?.longitude) ?? "";
  const radius = firstParam(params?.radius) ?? "25";
  const searched = Boolean(service.trim() || location.trim() || latitude.trim() || longitude.trim());

  const [locationSuggestions, search] = await Promise.all([
    getPublishedDirectoryLocationSuggestions(60),
    searched
      ? searchPublishedCompanyDirectory({ service, location, latitude, longitude, radiusKm: radius, limit: 30 })
      : Promise.resolve(null),
  ]);

  const serviceSuggestions = [...new Set(DIRECTORY_SERVICES.map((item) => item.label))];
  const nearbyActive = Boolean(search?.nearbyEnabled);

  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-lg font-black text-[#173e2b]">Proffera</Link>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#102a1c] px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a9dbb9]">Företagskatalog</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Hitta rätt företag för jobbet</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
            Sök efter tjänst och ort, eller använd din position för att hitta publicerade företag nära dig.
          </p>

          <PublicDirectorySearchForm
            service={service}
            location={location}
            radius={radius}
            serviceSuggestions={serviceSuggestions}
            locationSuggestions={locationSuggestions}
          />
        </section>

        <aside className="mt-5 rounded-2xl border border-[#d7e4da] bg-[#f2f8f4] p-4 text-sm leading-6 text-[#465349]">
          <div className="flex items-start gap-2">
            {nearbyActive ? <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#173e2b]" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#173e2b]" />}
            <p>
              {nearbyActive
                ? `Nära mig visar endast publicerade företag med verifierad position inom ${search?.radiusKm ?? 25} km.`
                : "Platsen i sökningen baseras på företagets registrerade adress. Det betyder inte automatiskt att företaget erbjuder tjänsten i hela området."}
            </p>
          </div>
        </aside>

        {!searched ? (
          <section className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-black/5 sm:p-7">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#173e2b]" />
              <h2 className="text-xl font-black">Populära tjänster</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#667168]">Välj en tjänst för att komma igång direkt.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {popularServices.map((item) => (
                <Link
                  key={item}
                  href={`/foretag/listad?service=${encodeURIComponent(item)}`}
                  className="rounded-full border border-[#173e2b]/15 bg-[#f2f8f4] px-4 py-2 text-sm font-black text-[#173e2b] transition hover:border-[#173e2b]/35 hover:bg-[#e9f3ec]"
                >
                  {item}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {search?.nearbyRequested && !search.nearbyEnabled ? (
          <div className="mt-6 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Positionen kunde inte tolkas. Prova Nära mig igen eller sök med ort.
          </div>
        ) : null}

        {search && !search.serviceResolved ? (
          <div className="mt-6 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Tjänsten känns inte igen ännu. Välj gärna ett förslag i listan eller prova en bredare tjänst.
          </div>
        ) : null}

        {search?.serviceResolved ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#647067]">Sökresultat</p>
                <h2 className="mt-1 text-2xl font-black">{search.results.length} företag</h2>
              </div>
              <p className="text-xs font-semibold text-[#758078]">
                {nearbyActive ? `Närmaste först · ${search.radiusKm} km` : "Endast publicerade profiler · max 30"}
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {search.results.map((result) => (
                <article key={result.id} className="rounded-2xl bg-white p-5 ring-1 ring-black/5 transition hover:shadow-sm sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#e8f2ec] px-3 py-1 text-xs font-black text-[#173e2b]">{result.matchedServiceLabel}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f2] px-3 py-1 text-xs font-bold text-[#536057]">
                          <ShieldCheck className="h-3.5 w-3.5" /> Officiella företagsdata
                        </span>
                        {result.distanceKm !== null ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-black text-[#315687]">
                            <Navigation className="h-3.5 w-3.5" /> {result.distanceKm.toFixed(1)} km bort
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-xl font-black">{result.companyName}</h3>
                      <p className="mt-2 flex items-center gap-2 text-sm text-[#5f6a62]">
                        <MapPin className="h-4 w-4 shrink-0" /> {[result.postalCode, result.city].filter(Boolean).join(" ") || result.municipality || "Sverige"}
                      </p>
                      {result.activityDescription ? (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#69736c]">{compactDescription(result.activityDescription)}</p>
                      ) : null}
                    </div>
                    <Link
                      href={`/foretag/listad/${encodeURIComponent(result.slug)}`}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#173e2b] px-4 text-sm font-black text-[#173e2b] transition hover:bg-[#173e2b] hover:text-white"
                    >
                      Visa profil <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}

              {search.results.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 text-sm leading-6 text-[#68736b] ring-1 ring-black/5">
                  {nearbyActive
                    ? `Inga publicerade företag med verifierad position hittades inom ${search.radiusKm} km ännu.`
                    : "Inga publicerade företag hittades för den här sökningen ännu."}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
