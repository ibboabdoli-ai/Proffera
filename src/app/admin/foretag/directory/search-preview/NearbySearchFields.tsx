"use client";

import { useState } from "react";

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

export function NearbySearchFields({
  defaultLatitude = "",
  defaultLongitude = "",
  defaultRadius = "25",
}: {
  defaultLatitude?: string;
  defaultLongitude?: string;
  defaultRadius?: string;
}) {
  const [latitude, setLatitude] = useState(defaultLatitude);
  const [longitude, setLongitude] = useState(defaultLongitude);
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setStatus("Webbläsaren stöder inte platsdelning.");
      return;
    }
    if (locating) return;

    setLocating(true);
    setStatus("Hämtar position…");

    const handlePosition = (position: GeolocationPosition) => {
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
      setLocating(false);
      setStatus("Position hämtad. Tryck Sök.");
    };

    const handleFinalError = (error: GeolocationPositionError) => {
      setLocating(false);
      if (error.code === error.PERMISSION_DENIED) {
        setStatus("Platsåtkomst är blockerad. Tillåt plats för proffera.se och försök igen.");
        return;
      }
      if (error.code === error.TIMEOUT) {
        setStatus("Det tog för lång tid att hämta positionen. Försök igen eller fyll i koordinater manuellt.");
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

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end">
      <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
        Latitude
        <input
          name="latitude"
          value={latitude}
          onChange={(event) => setLatitude(event.target.value)}
          placeholder="59.3293"
          inputMode="decimal"
          className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
        Longitude
        <input
          name="longitude"
          value={longitude}
          onChange={(event) => setLongitude(event.target.value)}
          placeholder="18.0686"
          inputMode="decimal"
          className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
        Radius km
        <input
          name="radius"
          defaultValue={defaultRadius}
          inputMode="decimal"
          className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
        />
      </label>
      <button
        type="button"
        onClick={useCurrentPosition}
        disabled={locating}
        aria-busy={locating}
        className="min-h-12 rounded-xl border border-[#17452f]/20 bg-[#edf4ef] px-4 text-sm font-black text-[#17452f] disabled:cursor-wait disabled:opacity-60"
      >
        {locating ? "Hämtar…" : "Använd min position"}
      </button>
      {status ? <p role="status" className="text-xs font-semibold text-[#667169] sm:col-span-4">{status}</p> : null}
    </div>
  );
}
