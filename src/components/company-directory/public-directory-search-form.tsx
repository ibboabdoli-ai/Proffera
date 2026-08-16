"use client";

import { MapPin, Navigation, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import { directoryCopy, directoryPaths, normalizeDirectoryPublicServiceQuery } from "@/components/company-directory/public-directory-copy";
import type { PublicLocale } from "@/lib/public-locale";

export function PublicDirectorySearchForm({
  locale,
  service,
  location,
  radius = "25",
  serviceSuggestions,
  locationSuggestions,
}: {
  locale: PublicLocale;
  service: string;
  location: string;
  radius?: string;
  serviceSuggestions: string[];
  locationSuggestions: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [nearbyStatus, setNearbyStatus] = useState("");
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const t = directoryCopy[locale];
  const searchPath = directoryPaths[locale].search;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const serviceValue = normalizeDirectoryPublicServiceQuery(String(formData.get("service") ?? ""), locale);
    const locationValue = String(formData.get("location") ?? "").trim();
    if (serviceValue) params.set("service", serviceValue);
    if (locationValue) params.set("location", locationValue);
    router.push(params.size ? `${searchPath}?${params.toString()}` : searchPath);
  }

  function useNearby() {
    if (!navigator.geolocation) {
      setNearbyStatus(t.noGeo);
      return;
    }

    setNearbyLoading(true);
    setNearbyStatus(t.locating);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const form = formRef.current;
        const formData = form ? new FormData(form) : new FormData();
        const currentService = normalizeDirectoryPublicServiceQuery(String(formData.get("service") ?? ""), locale);
        const params = new URLSearchParams();
        if (currentService) params.set("service", currentService);
        params.set("latitude", position.coords.latitude.toFixed(6));
        params.set("longitude", position.coords.longitude.toFixed(6));
        params.set("radius", radius);
        setNearbyStatus(t.found);
        setNearbyLoading(false);
        router.push(`${searchPath}?${params.toString()}`);
      },
      () => {
        setNearbyLoading(false);
        setNearbyStatus(t.geoError);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div>
      <form
        ref={formRef}
        method="get"
        onSubmit={submitSearch}
        className="mt-8 grid gap-3 rounded-panel border border-white/10 bg-surface p-3 text-ink shadow-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
      >
        <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-muted">
          {t.service}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="service"
              defaultValue={service}
              list={`directory-service-suggestions-${locale}`}
              autoComplete="off"
              placeholder={t.servicePlaceholder}
              className="min-h-12 w-full rounded-control border border-line bg-surface-subtle pl-10 pr-4 text-sm font-semibold normal-case tracking-normal text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/10"
            />
          </div>
          <datalist id={`directory-service-suggestions-${locale}`}>
            {serviceSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-muted">
          {t.location}
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="location"
              defaultValue={location}
              list={`directory-location-suggestions-${locale}`}
              autoComplete="off"
              placeholder={t.locationPlaceholder}
              className="min-h-12 w-full rounded-control border border-line bg-surface-subtle pl-10 pr-4 text-sm font-semibold normal-case tracking-normal text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/10"
            />
          </div>
          <datalist id={`directory-location-suggestions-${locale}`}>
            {locationSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        </label>

        <button type="submit" className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep">
          <Search className="h-4 w-4" /> {t.search}
        </button>

        <button
          type="button"
          onClick={useNearby}
          disabled={nearbyLoading}
          className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-line bg-brand-soft px-4 text-sm font-black text-brand transition hover:border-brand/30 hover:bg-brand-soft/70 disabled:cursor-wait disabled:opacity-60"
        >
          <Navigation className="h-4 w-4" /> {nearbyLoading ? t.loading : t.nearby}
        </button>
      </form>
      {nearbyStatus ? <p role="status" className="mt-2 px-1 text-xs font-semibold text-white/75">{nearbyStatus}</p> : null}
    </div>
  );
}
