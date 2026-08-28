"use client";

import { MapPin, Navigation, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { searchPublicDirectoryNearbyAction } from "@/components/company-directory/public-directory-nearby-action";
import { directoryCopy, directoryPaths, normalizeDirectoryPublicServiceQuery } from "@/components/company-directory/public-directory-copy";
import type { PublicLocale } from "@/lib/public-locale";

const FAST_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12000,
  maximumAge: 300000,
};

const ACCURATE_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 300000,
};

export function PublicDirectorySearchForm({
  locale,
  service,
  location,
  radius = "25",
  nearbyActive = false,
  serviceSuggestions,
  locationSuggestions,
  tone = "dark",
  layout = "default",
}: {
  locale: PublicLocale;
  service: string;
  location: string;
  radius?: string;
  nearbyActive?: boolean;
  serviceSuggestions: string[];
  locationSuggestions: string[];
  tone?: "light" | "dark";
  layout?: "default" | "hero";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const t = directoryCopy[locale];
  const searchPath = directoryPaths[locale].search;
  const nearbyLocationLabel = locale === "sv" ? "Min plats" : "My location";
  const permissionDeniedMessage = locale === "sv"
    ? "Platsåtkomst är blockerad. Tillåt plats för proffera.se i webbläsarens eller telefonens inställningar och försök igen."
    : "Location access is blocked. Allow location for proffera.se in your browser or phone settings and try again.";
  const positionUnavailableMessage = locale === "sv"
    ? "Din position kunde inte fastställas just nu. Kontrollera att platstjänster är på och försök igen, eller sök med ort."
    : "Your position could not be determined right now. Check that location services are on and try again, or search by location.";
  const retryingLocationMessage = locale === "sv"
    ? "Första försöket misslyckades. Försöker hämta en noggrannare position…"
    : "The first attempt failed. Trying a more accurate position…";
  const nearbySubmitErrorMessage = locale === "sv"
    ? "Positionen hittades men sökningen kunde inte startas. Försök igen."
    : "Your position was found, but the search could not start. Please try again.";
  const [locationValue, setLocationValue] = useState(nearbyActive ? nearbyLocationLabel : location);
  const [usingNearby, setUsingNearby] = useState(nearbyActive);
  const [nearbyStatus, setNearbyStatus] = useState("");
  const [nearbyLoading, setNearbyLoading] = useState(false);

  useEffect(() => {
    if (!nearbyActive) return;
    setNearbyLoading(false);
    setUsingNearby(true);
    setLocationValue(nearbyLocationLabel);
  }, [nearbyActive, nearbyLocationLabel]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const serviceValue = normalizeDirectoryPublicServiceQuery(String(formData.get("service") ?? ""), locale);
    if (serviceValue) params.set("service", serviceValue);

    if (usingNearby) {
      params.set("nearby", "1");
      params.set("radius", radius);
    } else {
      const manualLocation = locationValue.trim();
      if (manualLocation) params.set("location", manualLocation);
    }

    router.push(params.size ? `${searchPath}?${params.toString()}` : searchPath);
  }

  function useNearby() {
    if (!navigator.geolocation) {
      setNearbyStatus(t.noGeo);
      return;
    }

    setNearbyLoading(true);
    setNearbyStatus(t.locating);

    const handlePosition = (position: GeolocationPosition) => {
      const form = formRef.current;
      const formData = form ? new FormData(form) : new FormData();
      formData.set("locale", locale);
      formData.set("radius", radius);
      formData.set(
        "nearbyCoordinates",
        `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`,
      );
      setLocationValue(nearbyLocationLabel);
      setUsingNearby(true);
      setNearbyStatus(t.found);

      void searchPublicDirectoryNearbyAction(formData).catch(() => {
        setNearbyLoading(false);
        setUsingNearby(false);
        setLocationValue(location);
        setNearbyStatus(nearbySubmitErrorMessage);
      });
    };

    const handleFinalError = (error: GeolocationPositionError) => {
      setNearbyLoading(false);
      setNearbyStatus(error.code === error.PERMISSION_DENIED ? permissionDeniedMessage : positionUnavailableMessage);
    };

    navigator.geolocation.getCurrentPosition(
      handlePosition,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          handleFinalError(error);
          return;
        }

        setNearbyStatus(retryingLocationMessage);
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          handleFinalError,
          ACCURATE_GEOLOCATION_OPTIONS,
        );
      },
      FAST_GEOLOCATION_OPTIONS,
    );
  }

  const isHero = layout === "hero";
  const formClassName = isHero
    ? "grid gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_auto_auto]"
    : tone === "light"
      ? "mt-7 grid gap-3 rounded-panel border border-line bg-surface p-3 text-ink shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
      : "mt-8 grid gap-3 rounded-panel border border-white/10 bg-surface p-3 text-ink shadow-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]";
  const labelClassName = isHero
    ? "min-w-0"
    : "grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-muted";
  const labelTextClassName = isHero ? "sr-only" : undefined;
  const inputClassName = isHero
    ? "min-h-14 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-base font-semibold normal-case tracking-normal text-ink outline-none transition placeholder:font-medium placeholder:text-muted/75 focus:border-brand focus:ring-2 focus:ring-brand/10"
    : "min-h-12 w-full rounded-control border border-line bg-surface-subtle pl-10 pr-4 text-sm font-semibold normal-case tracking-normal text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/10";

  return (
    <div>
      <form
        ref={formRef}
        method="get"
        onSubmit={submitSearch}
        className={formClassName}
      >
        <label className={labelClassName}>
          <span className={labelTextClassName}>{t.service}</span>
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted ${isHero ? "h-5 w-5" : "h-4 w-4"}`} />
            <input
              name="service"
              defaultValue={service}
              list={`directory-service-suggestions-${locale}`}
              autoComplete="off"
              placeholder={t.servicePlaceholder}
              className={inputClassName}
            />
          </div>
          <datalist id={`directory-service-suggestions-${locale}`}>
            {serviceSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        </label>

        <label className={labelClassName}>
          <span className={labelTextClassName}>{t.location}</span>
          <div className="relative">
            <MapPin className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted ${isHero ? "h-5 w-5" : "h-4 w-4"}`} />
            <input
              name="location"
              value={locationValue}
              onChange={(event) => {
                setLocationValue(event.target.value);
                setUsingNearby(false);
                setNearbyStatus("");
              }}
              list={`directory-location-suggestions-${locale}`}
              autoComplete="off"
              placeholder={t.locationPlaceholder}
              className={inputClassName}
            />
          </div>
          <datalist id={`directory-location-suggestions-${locale}`}>
            {locationSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        </label>

        <button type="submit" className={`${isHero ? "min-h-14 rounded-xl px-6 text-base" : "mt-auto min-h-12 rounded-control px-5 text-sm"} inline-flex items-center justify-center gap-2 bg-brand font-black text-white transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface`}>
          <Search className="h-4 w-4" /> {t.search}
        </button>

        <button
          type="button"
          onClick={useNearby}
          disabled={nearbyLoading}
          className={`${isHero ? "min-h-14 rounded-xl px-5 text-base" : "mt-auto min-h-12 rounded-control px-4 text-sm"} inline-flex items-center justify-center gap-2 border border-line bg-brand-soft font-black text-brand transition hover:border-brand/30 hover:bg-brand-soft/70 disabled:cursor-wait disabled:opacity-60`}
        >
          <Navigation className="h-4 w-4" /> {nearbyLoading ? t.loading : t.nearby}
        </button>
      </form>
      {nearbyStatus ? <p role="status" className={`mt-2 px-1 text-xs font-semibold ${tone === "light" || isHero ? "text-muted" : "text-white/75"}`}>{nearbyStatus}</p> : null}
    </div>
  );
}
