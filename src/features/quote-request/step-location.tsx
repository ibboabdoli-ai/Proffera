"use client";

import { MapPin, Navigation } from "lucide-react";
import { useRef, useState } from "react";

import { quoteFormCopy } from "./form-copy";
import styles from "./quote-request-marketplace.module.css";
import type { QuoteFormStepProps } from "./step-props";

function ErrorText({ id, value }: { id: string; value?: string }) {
  return value ? <p id={id} className={styles.errorText}>{value}</p> : null;
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

  return <div className={styles.stack}>
    <div>
      <p className={styles.locationLead}>{t.locationLead}</p>
      <div className={styles.locationRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="addressLine1">{t.address}</label>
          <div className={styles.inputIconWrap}>
            <MapPin aria-hidden="true" />
            <input
              id="addressLine1"
              autoComplete="street-address"
              value={data.addressLine1}
              onChange={(event) => updateAddress(event.target.value)}
              placeholder={t.addressHint}
              className={styles.input}
              aria-invalid={errors.addressLine1 ? true : undefined}
              aria-describedby={errors.addressLine1 ? "quote-address-line-1-error" : undefined}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={useNearby}
          disabled={nearbyLoading}
          aria-pressed={nearbyActive}
          className={styles.nearButton}
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          {nearbyLoading ? t.nearMeLoading : t.nearMe}
        </button>
      </div>
      <ErrorText id="quote-address-line-1-error" value={errors.addressLine1} />
      {nearbyStatus ? <p className={`${styles.statusText} ${nearbyActive ? styles.statusActive : ""}`}>{nearbyStatus}</p> : null}
    </div>

    <div className={styles.twoCol}>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="city">{t.city}</label>
        <input
          id="city"
          autoComplete="address-level2"
          value={data.city}
          onChange={(event) => update("city", event.target.value)}
          placeholder={t.cityHint}
          className={styles.input}
          aria-invalid={errors.city ? true : undefined}
          aria-describedby={errors.city ? "quote-city-error" : undefined}
        />
        <ErrorText id="quote-city-error" value={errors.city} />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="postalCode">{t.postal}</label>
        <input
          id="postalCode"
          autoComplete="postal-code"
          inputMode="numeric"
          value={data.postalCode}
          onChange={(event) => update("postalCode", event.target.value)}
          placeholder={t.postalHint}
          className={styles.input}
          aria-invalid={errors.postalCode ? true : undefined}
          aria-describedby={errors.postalCode ? "quote-postal-code-error" : undefined}
        />
        <ErrorText id="quote-postal-code-error" value={errors.postalCode} />
      </div>
    </div>

    <div className={styles.infoNote}>{t.locationPrivacy}</div>
  </div>;
}
