import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, MapPin, Search, Settings2 } from "lucide-react";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getDirectoryGeocodingStatus } from "@/lib/company-directory-geocoding";
import { searchCompanyDirectory } from "@/lib/company-directory-search";
import { resolveDirectoryServiceQuery } from "@/lib/company-directory-service-taxonomy";
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
    needsReview?: string | string[];
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

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "neutral" | "total";
}) {
  const toneClass = {
    success: "border-[#b8d9c2] bg-[#eef8f0] text-[#17452f]",
    warning: "border-[#e5cf9a] bg-[#fff8e4] text-[#6d5418]",
    neutral: "border-black/10 bg-[#f7f7f4] text-[#465149]",
    total: "border-[#cdd6d0] bg-white text-[#17201a]",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
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
  const { latitude, longitude } = searchMode;
  const geocodeResult = firstParam(params?.geocode) ?? "";
  const nearbyAvailable = geocodingStatus.geocoded > 0;
  const nearbyAttempted = Boolean(latitude || longitude);
  const nearbyBlocked = nearbyAttempted && !nearbyAvailable;
  const blockedServiceQuery = service.trim().replace(/\s+/g, " ").slice(0, 100);
  const blockedLocationQuery = String(searchMode.location ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const blockedRadius = [25, 50, 100].includes(Number(radius)) ? Number(radius) : 25;

  const search = nearbyBlocked
    ? {
        serviceQuery: blockedServiceQuery,
        locationQuery: blockedLocationQuery,
        serviceResolved: !blockedServiceQuery || Boolean(resolveDirectoryServiceQuery(blockedServiceQuery)),
        nearbyRequested: true,
        nearbyEnabled: false,
        radiusKm: blockedRadius,
        results: [],
      }
    : await searchCompanyDirectory({
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
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Företagsdirectory · Intern kontroll</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Plats & sökning</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
              Resultaten är inte offentliga. Kontrollera företagsadresser och testa sökning på ort. Nära mig aktiveras först när verifierade företagspositioner finns.
            </p>
          </div>
          <Link href="/admin/foretag/directory" className="w-fit text-sm font-bold text-[#d6eadd] underline underline-offset-4">
            Tillbaka till Directory-kontroll
          </Link>
        </div>

        <section className="mt-7 rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#17452f]" />
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Företagspositioner</p>
              </div>
              <h2 className="mt-2 text-xl font-black text-[#17201a]">Adresskontroll för pilotföretag</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657068]">
                En adress räknas som klar först när Proffera har sparat en säker, verifierad position. Osäkra träffar läggs för granskning i stället.
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#edf4ef] px-3 py-1 text-xs font-black text-[#17452f]">
              Pilot · {geocodingStatus.pilotTotal} företag
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Klara" value={geocodingStatus.geocoded} tone="success" />
            <SummaryCard label="Behöver granskas" value={geocodingStatus.needsReview} tone="warning" />
            <SummaryCard label="Väntar" value={geocodingStatus.remaining} tone="neutral" />
            <SummaryCard label="Totalt" value={geocodingStatus.pilotTotal} tone="total" />
          </div>

          {geocodingStatus.needsReview > 0 ? (
            <div className="mt-4 flex gap-3 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-[#6d5418]">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{geocodingStatus.needsReview} adresser behöver granskas</p>
                <p className="mt-1 text-sm leading-6">
                  De är inte färdiga bara för att Väntar är 0. Ingen osäker position används i Nära mig.
                </p>
              </div>
            </div>
          ) : null}

          {geocodeResult === "done" ? (
            <div className="mt-4 rounded-xl border border-[#b8d9c2] bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f]">
              Senaste körningen: {firstParam(params?.geocoded) ?? "0"} klara · {firstParam(params?.noMatch) ?? "0"} behöver granskas · {firstParam(params?.errors) ?? "0"} fel · {firstParam(params?.remaining) ?? geocodingStatus.remaining} väntar.
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
              Geocoding-körningen misslyckades. Inga osäkra koordinater sparades.
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-[#657068]">
              {geocodingStatus.remaining > 0 ? (
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : geocodingStatus.needsReview > 0 ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8a691a]" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#17452f]" />
              )}
              <p>
                {geocodingStatus.remaining > 0
                  ? `${geocodingStatus.remaining} företag väntar på adresskontroll.`
                  : geocodingStatus.needsReview > 0
                    ? `Inget väntar på automatisk körning. ${geocodingStatus.needsReview} adresser ligger i granskning.`
                    : "Alla pilotadresser är behandlade."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {geocodingStatus.remaining > 0 ? (
                <form action={geocodeDirectoryPilotAction}>
                  <button
                    type="submit"
                    disabled={!geocodingStatus.configured || !geocodingStatus.postgisReady}
                    className="min-h-11 rounded-xl bg-[#173e2b] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#d9dedb] disabled:text-[#7b847e]"
                  >
                    Geokoda nästa 5
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <details className="mt-5 rounded-xl border border-black/5 bg-[#fafaf8] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#607066]">
              <Settings2 className="h-4 w-4" /> Teknisk status
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill ok={geocodingStatus.configured}>Lantmäteriet {geocodingStatus.configured ? "klar" : "saknar access"}</StatusPill>
              <StatusPill ok={geocodingStatus.postgisReady}>PostGIS {geocodingStatus.postgisReady ? "klar" : "inte aktiv"}</StatusPill>
              <StatusPill ok={geocodingStatus.enabled}>Geocoding {geocodingStatus.enabled ? "på" : "av"}</StatusPill>
            </div>
          </details>
        </section>

        <form className="mt-7 grid gap-5 rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-6" method="get">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Testa sökning</p>
            <h2 className="mt-1 text-xl font-black text-[#17201a]">Sök på ort</h2>
            <p className="mt-2 text-sm leading-6 text-[#657068]">
              Den här sökningen fungerar även innan företagen har koordinater.
            </p>
          </div>

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
              Ort
              <input
                id="directory-search-location"
                name="location"
                defaultValue={search.locationQuery}
                placeholder="Till exempel Södertälje"
                className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
              />
            </label>
            <button className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 font-black text-white" type="submit">
              <Search className="h-4 w-4" /> Sök på ort
            </button>
          </div>

          <div className="border-t border-black/5 pt-5">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Alternativ</p>
              <h3 className="mt-1 text-lg font-black text-[#17201a]">Nära mig</h3>
              <p className="mt-1 text-sm leading-6 text-[#657068]">
                Visar bara företag som redan har en verifierad position.
              </p>
            </div>
            <NearbySearchFields
              defaultLatitude={latitude}
              defaultLongitude={longitude}
              defaultRadius={String(search.radiusKm)}
              locationInputId="directory-search-location"
              available={nearbyAvailable}
              unavailableMessage={
                geocodingStatus.needsReview > 0
                  ? `${geocodingStatus.needsReview} företagsadresser behöver granskas innan Nära mig kan ge ett riktigt resultat.`
                  : "Inga verifierade företagspositioner finns ännu."
              }
            />
          </div>
        </form>

        {!search.serviceResolved ? (
          <div className="mt-5 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Tjänsten känns inte igen ännu. Testa till exempel Rörmokare, Elektriker, Städning, Målare eller Snickare.
          </div>
        ) : null}

        {search.nearbyRequested && !search.nearbyEnabled && nearbyAvailable ? (
          <div className="mt-5 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Positionen är inte komplett. Använd knappen Använd min position och försök igen.
          </div>
        ) : null}

        {search.nearbyEnabled && nearbyAvailable ? (
          <div className="mt-5 rounded-2xl border border-[#b8d9c2] bg-[#eef8f0] p-4 text-sm font-semibold text-[#17452f]">
            Nära mig är aktivt: verifierade företag inom {search.radiusKm} km visas när de matchar tjänsten.
          </div>
        ) : null}

        {nearbyBlocked ? (
          <div className="mt-7 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-5 text-[#6d5418]">
            <p className="font-black">Nära mig kan inte testas ännu</p>
            <p className="mt-2 text-sm leading-6">
              Det finns inga verifierade företagspositioner att mäta avstånd till. Detta är ett systemläge, inte ett riktigt sökresultat med 0 företag.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Pilotresultat</p>
                <h2 className="mt-1 text-2xl font-black text-[#17201a]">{search.results.length} företag</h2>
              </div>
              <p className="text-xs text-[#727d75]">
                {search.nearbyEnabled ? `Avstånd · ${search.radiusKm} km` : "Ready + gatuadress"} · max 30
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
                    ? "Inga matchande företag med verifierad position finns inom den valda radien."
                    : "Inga matchande Ready-profiler med gatuadress hittades för den här kombinationen."}
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
