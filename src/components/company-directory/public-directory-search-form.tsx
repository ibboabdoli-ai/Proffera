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
        className="mt-7 grid gap-3 rounded-2xl bg-white p-3 text-[#17201a] lg:grid-cols-[1fr_1fr_auto_auto]"
      >
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#5e6a61]">
          {t.service}
          <input
            name="service"
            defaultValue={service}
            list={`directory-service-suggestions-${locale}`}
            autoComplete="off"
            placeholder={t.servicePlaceholder}
            className="min-h-12 rounded-xl border border-black/10 bg-[#f8f9f7] px-4 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#173e2b]"
          />
          <datalist id={`directory-service-suggestions-${locale}`}>
            {serviceSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        </label>

        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#5e6a61]">
          {t.location}
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758078]" />
            <input
              name="location"
              defaultValue={location}
              list={`directory-location-suggestions-${locale}`}
              autoComplete="off"
              placeholder={t.locationPlaceholder}
              className="min-h-12 w-full rounded-xl border border-black/10 bg-[#f8f9f7] pl-10 pr-4 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#173e2b]"
            />
          </div>
          <datalist id={`directory-location-suggestions-${locale}`}>
            {locationSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        </label>

        <button type="submit" className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 font-black text-white">
          <Search className="h-4 w-4" /> {t.search}
        </button>

        <button
          type="button"
          onClick={useNearby}
          disabled={nearbyLoading}
          className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#173e2b]/20 bg-[#edf4ef] px-4 text-sm font-black text-[#173e2b] disabled:cursor-wait disabled:opacity-60"
        >
          <Navigation className="h-4 w-4" /> {nearbyLoading ? t.loading : t.nearby}
        </button>
      </form>
      {nearbyStatus ? <p className="mt-2 px-1 text-xs font-semibold text-white/75">{nearbyStatus}</p> : null}
    </div>
  );
}
