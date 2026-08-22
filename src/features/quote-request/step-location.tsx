"use client";

import { MapPin, Navigation } from "lucide-react";
import { useRef, useState } from "react";

import { quoteFormCopy } from "./form-copy";
import type { QuoteFormStepProps } from "./step-props";

function ErrorText({ value }: { value?: string }) {
  return value ? <p className="mt-2 text-sm font-medium text-red-700">{value}</p> : null;
}

export function QuoteLocationStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  const [nearbyStatus, setNearbyStatus] = useState("");
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const nearbyRequestId = useRef(0);
  const nearbyActive = data.locationSource === "geolocation" && data.latitude !== null && data.longitude !== null;

  function useNearby() {
    const requestId = ++nearbyRequestId.current;
    if (!navigator.geolocation) {
      setNearbyStatus(t.nearMeUnsupported);
      return;
    }

    setNearbyLoading(true);
    setNearbyStatus("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== nearbyRequestId.current) return;
        update("addressLine1", "");
        update("latitude", Number(position.coords.latitude.toFixed(6)));
        update("longitude", Number(position.coords.longitude.toFixed(6)));
        update("locationSource", "geolocation");
        setNearbyLoading(false);
        setNearbyStatus(t.nearMeFound);
      },
      () => {
        if (requestId !== nearbyRequestId.current) return;
        setNearbyLoading(false);
        setNearbyStatus(t.nearMeDenied);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function updateAddress(value: string) {
    nearbyRequestId.current += 1;
    setNearbyLoading(false);
    if (data.locationSource === "geolocation") {
      update("locationSource", "address");
      update("latitude", null);
      update("longitude", null);
    }
    setNearbyStatus("");
    update("addressLine1", value);
  }

  return <div className="space-y-6">
    <div>
      <p className="text-sm leading-6 text-[#5b665f]">{t.locationLead}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="text-sm font-semibold text-[#17201a]" htmlFor="addressLine1">{t.address}</label>
          <div className="relative mt-2">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#728078]" aria-hidden="true" />
            <input
              id="addressLine1"
              autoComplete="street-address"
              value={data.addressLine1}
              onChange={(event) => updateAddress(event.target.value)}
              placeholder={t.addressHint}
              className="w-full rounded-2xl border border-[#dfe5dd] py-3 pl-11 pr-4 outline-none focus:border-[#17452f]"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={useNearby}
          disabled={nearbyLoading}
          aria-pressed={nearbyActive}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#17452f]/20 bg-[#eef5ef] px-5 text-sm font-semibold text-[#17452f] transition hover:bg-[#e3eee5] disabled:cursor-wait disabled:opacity-60"
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          {nearbyLoading ? t.nearMeLoading : t.nearMe}
        </button>
      </div>
      <ErrorText value={errors.addressLine1} />
      {nearbyStatus ? <p className={`mt-2 text-sm font-medium ${nearbyActive ? "text-[#17452f]" : "text-[#5b665f]"}`}>{nearbyStatus}</p> : null}
    </div>

    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="text-sm font-semibold text-[#17201a]" htmlFor="city">{t.city}</label>
        <input id="city" autoComplete="address-level2" value={data.city} onChange={(event) => update("city", event.target.value)} placeholder={t.cityHint} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]" />
        <ErrorText value={errors.city} />
      </div>
      <div>
        <label className="text-sm font-semibold text-[#17201a]" htmlFor="postalCode">{t.postal}</label>
        <input id="postalCode" autoComplete="postal-code" inputMode="numeric" value={data.postalCode} onChange={(event) => update("postalCode", event.target.value)} placeholder={t.postalHint} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]" />
        <ErrorText value={errors.postalCode} />
      </div>
    </div>

    <div className="rounded-2xl border border-[#dfe5dd] bg-[#f7faf7] px-4 py-3 text-sm leading-6 text-[#5b665f]">
      {t.locationPrivacy}
    </div>
  </div>;
}
