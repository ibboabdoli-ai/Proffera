"use client";

import { useState } from "react";

import {
  applyAdminCurrentPosition,
  applyAdminManualCoordinateEdit,
} from "./search-behavior";

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

const RADIUS_OPTIONS = [25, 50, 100];

/** Renders the admin-only Nearby controls and keeps browser coordinates synchronized with the search form. */
export function NearbySearchFields({
  defaultLatitude = "",
  defaultLongitude = "",
  defaultRadius = "25",
  locationInputId = "",
  available = true,
  unavailableMessage = "Nära mig är inte redo ännu.",
  searchNearbyAction,
}: {
  defaultLatitude?: string;
  defaultLongitude?: string;
  defaultRadius?: string;
  locationInputId?: string;
  available?: boolean;
  unavailableMessage?: string;
  searchNearbyAction: (formData: FormData) => Promise<void>;
}) {
  const [latitude, setLatitude] = useState(defaultLatitude);
  const [longitude, setLongitude] = useState(defaultLongitude);
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const hasPosition = Boolean(latitude && longitude);
  const normalizedDefaultRadius = RADIUS_OPTIONS.includes(Number(defaultRadius)) ? defaultRadius : "25";

  /** Resolves the sibling manual-location field when this component needs to make Nearby the active mode. */
  function getManualLocationField() {
    const locationElement = locationInputId ? document.getElementById(locationInputId) : null;
    return locationElement instanceof HTMLInputElement ? locationElement : null;
  }

  /** Requests the browser position, retrying once with higher accuracy for recoverable failures. */
  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setStatus("Webbläsaren stöder inte platsdelning.");
      return;
    }
    if (locating) return;

    setLocating(true);
    setStatus("Hämtar position…");

    /** Applies a successful browser position and clears a conflicting manual location. */
    const handlePosition = (position: GeolocationPosition) => {
      const next = applyAdminCurrentPosition(position, getManualLocationField());

      setLatitude(next.latitude);
      setLongitude(next.longitude);
      setLocating(false);
      setStatus(next.status);
    };

    /** Converts the final geolocation failure into a concise, actionable admin status. */
    const handleFinalError = (error: GeolocationPositionError) => {
      setLocating(false);
      if (error.code === error.PERMISSION_DENIED) {
        setStatus("Platsåtkomst är blockerad. Tillåt plats för proffera.se och försök igen.");
        return;
      }
      if (error.code === error.TIMEOUT) {
        setStatus("Det tog för lång tid att hämta positionen. Försök igen.");
        return;
      }
      setStatus("Kunde inte läsa positionen. Kontrollera att platstjänster är på och försök igen.");
    };

    navigator.geolocation.getCurrentPosition(
      handlePosition,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          handleFinalError(error);
          return;
        }

        setStatus("Första försöket misslyckades. Försöker hämta en noggrannare position…");
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          handleFinalError,
          ACCURATE_GEOLOCATION_OPTIONS,
        );
      },
      FAST_GEOLOCATION_OPTIONS,
    );
  }

  if (!available) {
    return (
      <div className="rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4">
        <p className="font-black text-[#5f4a13]">Nära mig är inte redo ännu</p>
        <p className="mt-1 text-sm leading-6 text-[#765f24]">{unavailableMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
          Avstånd
          <select
            name="radius"
            defaultValue={normalizedDefaultRadius}
            className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
          >
            {RADIUS_OPTIONS.map((radius) => (
              <option key={radius} value={radius}>{radius} km</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={useCurrentPosition}
          disabled={locating}
          aria-busy={locating}
          className="min-h-12 rounded-xl border border-[#17452f]/20 bg-[#edf4ef] px-4 text-sm font-black text-[#17452f] disabled:cursor-wait disabled:opacity-60"
        >
          {locating ? "Hämtar position…" : hasPosition ? "Uppdatera min position" : "Använd min position"}
        </button>

        <button
          type="submit"
          name="nearbyCoordinates"
          value={hasPosition ? `${latitude},${longitude}` : ""}
          formAction={searchNearbyAction}
          disabled={!hasPosition || locating}
          className="min-h-12 rounded-xl bg-[#173e2b] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#d9dedb] disabled:text-[#7b847e]"
        >
          Sök nära mig
        </button>
      </div>

      {status ? <p role="status" className="text-xs font-semibold text-[#667169]">{status}</p> : null}

      <details className="rounded-xl border border-black/5 bg-[#fafaf8] px-4 py-3">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-[#607066]">
          Teknisk info
        </summary>
        <p className="mt-2 text-xs leading-5 text-[#717b74]">
          Webbläsarens koordinater används för själva Nära mig-sökningen men läggs inte i URL:en. Normalt räcker knappen Använd min position; fälten nedan är främst för felsökning.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-xs font-bold text-[#465149]">
            Latitude
            <input
              aria-label="Latitude"
              value={latitude}
              onChange={(event) => {
                setLatitude(applyAdminManualCoordinateEdit(event.target.value, getManualLocationField()));
              }}
              placeholder="59.3293"
              inputMode="decimal"
              className="min-h-10 rounded-lg border border-black/10 bg-white px-3 font-medium outline-none focus:border-[#17452f]"
            />
          </label>
          <label className="grid gap-2 text-xs font-bold text-[#465149]">
            Longitude
            <input
              aria-label="Longitude"
              value={longitude}
              onChange={(event) => {
                setLongitude(applyAdminManualCoordinateEdit(event.target.value, getManualLocationField()));
              }}
              placeholder="18.0686"
              inputMode="decimal"
              className="min-h-10 rounded-lg border border-black/10 bg-white px-3 font-medium outline-none focus:border-[#17452f]"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
