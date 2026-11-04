"use client";

import { MapPin, Navigation, Search } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import {
  searchPublicDirectoryAddressAction,
  searchPublicDirectoryNearbyAction,
} from "@/components/company-directory/public-directory-nearby-action";
import { directoryCopy, normalizeDirectoryPublicServiceQuery } from "@/components/company-directory/public-directory-copy";
import type { PublicLocale } from "@/lib/public-locale";

const FAST_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false, timeout: 12000, maximumAge: 300000,
};
const ACCURATE_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true, timeout: 20000, maximumAge: 300000,
};

export function PublicDirectorySearchForm({
  locale, service, radius = "10", serviceSuggestions, tone = "dark", layout = "default",
}: {
  locale: PublicLocale;
  service: string;
  radius?: string;
  serviceSuggestions: string[];
  tone?: "light" | "dark";
  layout?: "default" | "hero";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const t = directoryCopy[locale];
  const [radiusKm, setRadiusKm] = useState(() => {
    const parsed = Number(radius);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(50, Math.round(parsed))) : 10;
  });
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const loading = pending || nearbyLoading;
  const isHero = layout === "hero";

  const permissionDeniedMessage = locale === "sv"
    ? "Platsåtkomst är blockerad. Tillåt plats för proffera.se i webbläsarens eller telefonens inställningar och försök igen."
    : "Location access is blocked. Allow location for proffera.se in your browser or phone settings and try again.";
  const positionUnavailableMessage = locale === "sv"
    ? "Din position kunde inte fastställas. Kontrollera platstjänsterna eller ange en adress."
    : "Your location could not be determined. Check location services or enter an address.";
  const retryingLocationMessage = locale === "sv"
    ? "Första försöket misslyckades. Försöker hämta en noggrannare position…"
    : "The first attempt failed. Trying to get a more accurate location…";
  const submitError = locale === "sv"
    ? "Positionen hittades men sökningen kunde inte startas. Försök igen."
    : "Your position was found, but the search could not start. Please try again.";

  function validService(formData: FormData) {
    return Boolean(normalizeDirectoryPublicServiceQuery(String(formData.get("service") ?? "").trim(), locale));
  }

  async function submitAddressSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const formData = new FormData(event.currentTarget);
    if (!validService(formData)) {
      setStatus(t.serviceRequired);
      return;
    }
    if (!String(formData.get("address") ?? "").trim()) {
      setStatus(t.addressRequired);
      return;
    }
    formData.set("locale", locale);
    formData.set("radius", String(radiusKm));
    setPending(true);
    setStatus("");
    try {
      const result = await searchPublicDirectoryAddressAction(formData);
      if (result?.error) {
        const messages = {
          invalid_address: t.addressInvalid,
          not_found: t.addressNotFound,
          unavailable: t.addressUnavailable,
          rate_limited: t.tooManyAddressSearches,
        };
        setStatus(messages[result.error]);
      }
    } catch {
      setStatus(t.addressUnavailable);
    } finally {
      setPending(false);
    }
  }

  function useNearby() {
    if (loading) return;
    const formData = formRef.current ? new FormData(formRef.current) : new FormData();
    if (!validService(formData)) {
      setStatus(t.serviceRequired);
      return;
    }
    if (!navigator.geolocation) {
      setStatus(t.noGeo);
      return;
    }
    setNearbyLoading(true);
    setStatus(t.locating);

    const handlePosition = (position: GeolocationPosition) => {
      formData.set("locale", locale);
      formData.set("radius", String(radiusKm));
      formData.set("nearbyCoordinates", [position.coords.latitude, position.coords.longitude].join(","));
      setStatus(t.found);
      void searchPublicDirectoryNearbyAction(formData)
        .catch(() => setStatus(submitError))
        .finally(() => setNearbyLoading(false));
    };
    const handleFinalError = (error: GeolocationPositionError) => {
      setNearbyLoading(false);
      setStatus(error.code === error.PERMISSION_DENIED ? permissionDeniedMessage : positionUnavailableMessage);
    };
    navigator.geolocation.getCurrentPosition(handlePosition, (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        handleFinalError(error);
        return;
      }
      setStatus(retryingLocationMessage);
      navigator.geolocation.getCurrentPosition(handlePosition, handleFinalError, ACCURATE_GEOLOCATION_OPTIONS);
    }, FAST_GEOLOCATION_OPTIONS);
  }

  const inputStyle = "min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-4 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const buttonStyle = "flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold disabled:cursor-wait disabled:opacity-60";

  return (
    <div>
      <form ref={formRef} method="post" onSubmit={(event) => { void submitAddressSearch(event); }}
        className={isHero
          ? "grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card lg:grid-cols-2"
          : "grid gap-3 rounded-panel border border-line bg-surface p-3 text-ink shadow-sm lg:grid-cols-2"}
      >
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
          <span>{t.service}</span>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input name="service" defaultValue={service} list={"directory-service-suggestions-" + locale}
              autoComplete="off" maxLength={100} placeholder={t.servicePlaceholder} className={inputStyle + " pl-11"} />
          </div>
          <datalist id={"directory-service-suggestions-" + locale}>
            {serviceSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
          <span>{t.location}</span>
          <div className="relative">
            <MapPin aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input name="address" type="text" maxLength={180} autoComplete="street-address"
              placeholder={t.locationPlaceholder} className={inputStyle + " pl-11"} />
          </div>
          <span className="text-xs font-normal text-muted">{t.addressHelp}</span>
        </label>
        <div className="grid gap-2 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
            <label htmlFor={"directory-radius-" + locale}>{t.searchRadius}</label>
            <output htmlFor={"directory-radius-" + locale}>{radiusKm} km</output>
          </div>
          <input id={"directory-radius-" + locale} name="radius" type="range" min={1} max={50} step={1}
            value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="w-full accent-brand" />
          <div className="flex justify-between text-xs text-muted"><span>1 km</span><span>50 km</span></div>
        </div>
        <button type="submit" disabled={loading} className={buttonStyle + " bg-brand text-white hover:bg-brand-strong"}>
          <Search aria-hidden="true" className="h-4 w-4" />{pending ? t.loading : t.search}
        </button>
        <button type="button" onClick={useNearby} disabled={loading}
          className={buttonStyle + " border border-line bg-brand-soft text-brand hover:bg-brand-soft/70"}>
          <Navigation aria-hidden="true" className="h-4 w-4" />{nearbyLoading ? t.loading : t.nearby}
        </button>
      </form>
      {status ? <p role="status" className={"mt-2 px-1 text-sm font-semibold " + (tone === "light" || isHero ? "text-muted" : "text-white/75")}>{status}</p> : null}
    </div>
  );
}
