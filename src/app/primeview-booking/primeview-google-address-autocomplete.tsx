"use client";

import { useEffect, useRef, useState } from "react";

type AddressSelection = {
  address: string;
  postcode: string;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  formattedAddress?: string | null;
  addressComponents?: GoogleAddressComponent[] | null;
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};

type GooglePlacePrediction = {
  toPlace: () => GooglePlace;
};

type GooglePlaceSelectEvent = Event & {
  placePrediction?: GooglePlacePrediction;
};

type GooglePlaceAutocompleteElement = HTMLElement & {
  includedRegionCodes: string[];
  placeholder: string;
};

type GooglePlacesLibrary = {
  PlaceAutocompleteElement: new () => GooglePlaceAutocompleteElement;
};

type GoogleMapsGlobal = {
  maps: {
    importLibrary: (library: "places") => Promise<GooglePlacesLibrary>;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
    __primeViewGoogleMapsPromise?: Promise<void>;
  }
}

const GOOGLE_SCRIPT_SELECTOR = 'script[data-primeview-google-maps="true"]';

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (window.__primeViewGoogleMapsPromise) return window.__primeViewGoogleMapsPromise;

  window.__primeViewGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(GOOGLE_SCRIPT_SELECTOR);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.primeviewGoogleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });

  return window.__primeViewGoogleMapsPromise;
}

function postcodeFromComponents(components: GoogleAddressComponent[] | null | undefined) {
  const component = components?.find((item) => item.types?.includes("postal_code"));
  return (component?.longText ?? component?.shortText ?? "").trim().toUpperCase();
}

function cleanFormattedAddress(value: string | null | undefined) {
  return (value ?? "").replace(/,\s*(United Kingdom|UK)$/i, "").trim();
}

export function PrimeViewGoogleAddressAutocomplete({ onSelect }: { onSelect: (selection: AddressSelection) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [message, setMessage] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    let disposed = false;
    let autocomplete: GooglePlaceAutocompleteElement | null = null;
    let handleSelect: ((event: Event) => void) | null = null;

    if (!container) return;

    if (!apiKey) {
      setMessage("Address suggestions are unavailable. Enter the address manually below.");
      return;
    }

    setMessage("");

    void loadGoogleMaps(apiKey)
      .then(async () => {
        const googleMaps = window.google;
        if (!googleMaps?.maps?.importLibrary) throw new Error("Google Maps is unavailable.");

        const places = await googleMaps.maps.importLibrary("places");
        if (disposed) return;

        autocomplete = new places.PlaceAutocompleteElement();
        autocomplete.includedRegionCodes = ["gb"];
        autocomplete.placeholder = "Start typing house number or street";
        autocomplete.style.display = "block";
        autocomplete.style.width = "100%";

        handleSelect = (event: Event) => {
          void (async () => {
            const prediction = (event as GooglePlaceSelectEvent).placePrediction;
            if (!prediction) return;

            const place = prediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] });

            const address = cleanFormattedAddress(place.formattedAddress);
            const postcode = postcodeFromComponents(place.addressComponents);
            if (!address) {
              setMessage("We could not read that address. Please enter it manually below.");
              return;
            }

            onSelectRef.current({ address, postcode });
            setMessage(postcode ? "Address selected — postcode filled automatically." : "Address selected.");
          })().catch(() => {
            if (!disposed) setMessage("We could not read that address. Please enter it manually below.");
          });
        };

        autocomplete.addEventListener("gmp-select", handleSelect);
        container.replaceChildren(autocomplete);
      })
      .catch(() => {
        if (!disposed) setMessage("Google address suggestions could not load. Enter the address manually below.");
      });

    return () => {
      disposed = true;
      if (autocomplete && handleSelect) autocomplete.removeEventListener("gmp-select", handleSelect);
      container.replaceChildren();
    };
  }, [apiKey]);

  return (
    <div className="mt-3">
      <div ref={containerRef} />
      <p className={`mt-2 text-xs leading-5 ${message ? "font-semibold text-[#667b91]" : "text-[#667b91]"}`}>
        {message || "Start typing your address and choose the correct UK result. Address and postcode will fill automatically."}
      </p>
    </div>
  );
}
