"use client";

import { useState } from "react";

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

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setStatus("Webbläsaren stöder inte platsdelning.");
      return;
    }

    setStatus("Hämtar position…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setStatus("Position hämtad. Tryck Sök.");
      },
      () => setStatus("Kunde inte läsa positionen. Du kan fylla i koordinater manuellt."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
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
        className="min-h-12 rounded-xl border border-[#17452f]/20 bg-[#edf4ef] px-4 text-sm font-black text-[#17452f]"
      >
        Använd min position
      </button>
      {status ? <p className="text-xs font-semibold text-[#667169] sm:col-span-4">{status}</p> : null}
    </div>
  );
}
