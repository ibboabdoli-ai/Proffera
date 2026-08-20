import Link from "next/link";
import { MapPin, Search } from "lucide-react";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getDirectoryGeocodingStatus } from "@/lib/company-directory-geocoding";
import { searchCompanyDirectory } from "@/lib/company-directory-search";
import { geocodeDirectoryPilotAction } from "./actions";
import { NearbySearchFields } from "./NearbySearchFields";
import { resolveAdminDirectorySearchMode } from "./search-behavior";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    service?: string | string[];
    location?: string | string[];
    latitude?: string | string[];
    longitude?: string | string[];
    radius?: string | string[];
    geocode?: string | string[];
    attempted?: string | string[];
    geocoded?: string | string[];
    noMatch?: string | string[];
    errors?: string | string[];
    remaining?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function StatusPill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${ok ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#fff4d9] text-[#76580d]"}`}>
      {children}
    </span>
  );
}

export default async function DirectorySearchPreviewPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const [params, geocodingStatus] = await Promise.all([
    searchParams ?? Promise.resolve(undefined),
    getDirectoryGeocodingStatus(),
  ]);
  const service = firstParam(params?.service) ?? "Rörmokare";
  const radius = firstParam(params?.radius) ?? "25";
  const searchMode = resolveAdminDirectorySearchMode({
    location: firstParam(params?.location),
    latitude: firstParam(params?.latitude),
    longitude: firstParam(params?.longitude),
  });
  const { location, latitude, longitude } = searchMode;
  const geocodeResult = firstParam(params?.geocode) ?? "";

  const search = await searchCompanyDirectory({
    service,
    ...searchMode,
    radiusKm: radius,
    streetAddressOnly: true,
    limit: 30,
  });

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-9">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Directory Search Pilot</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Service + Location + Nära mig</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
              Intern söktest mot Ready-profiler. Resultaten är inte offentliga. Nära mig använder bara sparade, verifierade företagskoordinater.
            </p>
          </div>
          <Link href="/admin/foretag/directory" className="w-fit text-sm font-bold text-[#d6eadd] underline underline-offset-4">
            Tillbaka till Directory-kontroll
          </Link>
        </div>

        <section className="mt-7 rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#17452f]" />
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Officiell geocoding · Pilot</p>
              </div>
              <h2 className="mt-2 text-xl font-black text-[#17201a]">{geocodingStatus.geocoded} / {geocodingStatus.pilotTotal} företag har koordinater</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657068]">
                Endast de 26 utvalda pilotföretagen behandlas. Adresser som inte matchar entydigt sparas inte.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill ok={geocodingStatus.configured}>Lantmäteriet {geocodingStatus.configured ? "klar" : "saknar access"}</StatusPill>
              <StatusPill ok={geocodingStatus.postgisReady}>PostGIS {geocodingStatus.postgisReady ? "klar" : "inte aktiv"}</StatusPill>
              <StatusPill ok={geocodingStatus.enabled}>Geocoding {geocodingStatus.enabled ? "på" : "av"}</StatusPill>
            </div>
          </div>

          {geocodeResult === "done" ? (
            <div className="mt-4 rounded-xl border border-[#b8d9c2] bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f]">
              Batch klar: {firstParam(params?.geocoded) ?? "0"} geocodade · {firstParam(params?.noMatch) ?? "0"} utan säker träff · {firstParam(params?.errors) ?? "0"} fel · {firstParam(params?.remaining) ?? geocodingStatus.remaining} kvar.
            </div>
          ) : null}
          {geocodeResult === "not_configured" ? (
            <div className="mt-4 rounded-xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
              Lantmäteriet-access är inte konfigurerad ännu.
            </div>
          ) : null}
          {geocodeResult === "postgis_missing" ? (
            <div className="mt-4 rounded-xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
              PostGIS måste aktiveras innan SWEREF-koordinater kan konverteras säkert.
            </div>
          ) : null}
          {geocodeResult === "failed" ? (
            <div className="mt-4 rounded-xl border border-[#e7b8b1] bg-[#fff4f2] p-4 text-sm font-semibold text-[#8a2b20]">
              Geocoding-batchen misslyckades. Inga osäkra koordinater sparades.
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#657068]">{geocodingStatus.remaining} pilotföretag saknar fortfarande koordinater.</p>
            <form action={geocodeDirectoryPilotAction}>
              <button
                type="submit"
                disabled={!geocodingStatus.configured || !geocodingStatus.postgisReady || geocodingStatus.remaining === 0}
                className="min-h-11 rounded-xl bg-[#173e2b] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#d9dedb] disabled:text-[#7b847e]"
              >
                Geocode nästa 5
              </button>
            </form>
          </div>
        </section>

        <form className="mt-7 grid gap-5 rounded-2xl bg-white p-5 ring-1 ring-black/5" method="get">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
              Service
              <input
                name="service"
                defaultValue={search.serviceQuery}
                placeholder="Rörmokare"
                className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
              Plats
              <input
                id="directory-search-location"
                name="location"
                defaultValue={search.locationQuery}
                placeholder="Stockholm eller lämna tomt för Nära mig"
                className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
              />
            </label>
            <button className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 font-black text-white" type="submit">
              <Search className="h-4 w-4" /> Sök
            </button>
          </div>

          <div className="border-t border-black/5 pt-5">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Nära mig · valfritt</p>
            <NearbySearchFields
              defaultLatitude={latitude}
              defaultLongitude={longitude}
              defaultRadius={String(search.radiusKm)}
              locationInputId="directory-search-location"
            />
          </div>
        </form>

        {!search.serviceResolved ? (
          <div className="mt-5 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Tjänsten känns inte igen ännu. Testa till exempel Rörmokare, Elektriker, Städning, Målare eller Snickare.
          </div>
        ) : null}

        {search.nearbyRequested && !search.nearbyEnabled ? (
          <div className="mt-5 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Latitude och longitude måste båda vara giltiga för Nära mig.
          </div>
        ) : null}

        {search.nearbyEnabled ? (
          <div className="mt-5 rounded-2xl border border-[#b8d9c2] bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f]">
            Nära mig är aktivt: företag inom {search.radiusKm} km visas när verifierade företagskoordinater finns.
          </div>
        ) : null}

        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Pilotresultat</p>
            <h2 className="mt-1 text-2xl font-black text-[#17201a]">{search.results.length} företag</h2>
          </div>
          <p className="text-xs text-[#727d75]">
            {search.nearbyEnabled ? `Avstånd · ${search.radiusKm} km` : "Ready + street address"} · max 30
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {search.results.map((result, index) => (
            <article key={`${result.id}-${result.serviceSlug}`} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#6b766e]">#{index + 1} · {result.serviceLabel}</p>
                  <h3 className="mt-1 text-lg font-black text-[#202b24]">{result.companyName}</h3>
                  <p className="mt-2 text-sm text-[#5b665f]">
                    {[result.addressLine1, result.postalCode, result.city].filter(Boolean).join(", ")}
                  </p>
                  {result.distanceKm !== null ? (
                    <p className="mt-2 text-sm font-black text-[#17452f]">{result.distanceKm.toFixed(1)} km bort</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-[#edf4ef] px-3 py-1 text-[#17452f]">Quality {result.qualityScore}</span>
                  <span className="rounded-full bg-[#f0f1ee] px-3 py-1 text-[#5f6861]">{result.publicationStatus}</span>
                </div>
              </div>
            </article>
          ))}

          {search.serviceResolved && search.results.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-[#68736b] ring-1 ring-black/5">
              {search.nearbyEnabled
                ? "Inga matchande företag med verifierade koordinater finns ännu inom den valda radien."
                : "Inga matchande Ready-profiler med gatuadress hittades för den här kombinationen."}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
