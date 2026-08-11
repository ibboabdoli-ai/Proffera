"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

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

type GoogleFormattableText = {
  toString: () => string;
};

type GooglePlacePrediction = {
  text?: GoogleFormattableText;
  mainText?: GoogleFormattableText;
  secondaryText?: GoogleFormattableText;
  toPlace: () => GooglePlace;
};

type GoogleAutocompleteSuggestion = {
  placePrediction?: GooglePlacePrediction;
};

type GoogleAutocompleteSessionToken = object;

type GoogleAutocompleteRequest = {
  input: string;
  includedRegionCodes?: string[];
  locationBias?: { center: { lat: number; lng: number }; radius: number };
  language?: string;
  region?: string;
  sessionToken?: GoogleAutocompleteSessionToken;
};

type GooglePlacesLibrary = {
  AutocompleteSessionToken: new () => GoogleAutocompleteSessionToken;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: GoogleAutocompleteRequest) => Promise<{ suggestions: GoogleAutocompleteSuggestion[] }>;
  };
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
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (window.__primeViewGoogleMapsPromise) return window.__primeViewGoogleMapsPromise;

  window.__primeViewGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(GOOGLE_SCRIPT_SELECTOR);
    if (existing) {
      if (window.google?.maps?.importLibrary) {
        resolve();
        return;
      }
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

function normalizePostcode(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return value.toUpperCase().trim();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function currentPostcode() {
  const input = document.querySelector<HTMLInputElement>('input[name="postcode"]');
  const value = input?.value.trim() ?? "";
  return UK_POSTCODE.test(value) ? normalizePostcode(value) : "";
}

function predictionText(prediction: GooglePlacePrediction) {
  const main = prediction.mainText?.toString().trim() ?? "";
  const secondary = prediction.secondaryText?.toString().trim() ?? "";
  const full = prediction.text?.toString().trim() ?? "";
  return {
    main: main || full,
    secondary: secondary || (main && full.startsWith(main) ? full.slice(main.length).replace(/^,\s*/, "") : ""),
  };
}

export function PrimeViewGoogleAddressAutocomplete({ onSelect }: { onSelect: (selection: AddressSelection) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GooglePlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const placesRef = useRef<GooglePlacesLibrary | null>(null);
  const tokenRef = useRef<GoogleAutocompleteSessionToken | null>(null);
  const requestIdRef = useRef(0);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  useEffect(() => {
    let disposed = false;
    if (!apiKey) return;

    void loadGoogleMaps(apiKey)
      .then(async () => {
        const googleMaps = window.google;
        if (!googleMaps?.maps?.importLibrary) throw new Error("Google Maps is unavailable.");
        const places = await googleMaps.maps.importLibrary("places");
        if (!disposed) placesRef.current = places;
      })
      .catch(() => {
        if (!disposed) setMessage("Google address search could not load. Enter the address manually below.");
      });

    return () => {
      disposed = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const text = query.trim();
    if (!apiKey || text.length < 2) return;

    const timer = window.setTimeout(() => {
      const places = placesRef.current;
      if (!places) return;

      const postcode = currentPostcode();
      const compactPostcode = postcode.replace(/\s+/g, "");
      const upperText = text.toUpperCase();
      const input = postcode && !upperText.includes(postcode) && !upperText.includes(compactPostcode)
        ? `${text}, ${postcode}`
        : text;
      const requestId = ++requestIdRef.current;
      if (!tokenRef.current) tokenRef.current = new places.AutocompleteSessionToken();
      setLoading(true);
      setMessage("");

      void places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        includedRegionCodes: ["gb"],
        locationBias: { center: { lat: 51.515, lng: -0.18 }, radius: 35_000 },
        language: "en-GB",
        region: "gb",
        sessionToken: tokenRef.current,
      })
        .then(({ suggestions: next }) => {
          if (requestId !== requestIdRef.current) return;
          const predictions = next.map((item) => item.placePrediction).filter((item): item is GooglePlacePrediction => Boolean(item));
          setSuggestions(predictions.slice(0, 6));
          setOpen(predictions.length > 0);
          if (!predictions.length) setMessage(postcode ? `No match yet. Add the house number or street within ${postcode}.` : "No address matches yet. Keep typing the house number or street.");
        })
        .catch(() => {
          if (requestId === requestIdRef.current) {
            setSuggestions([]);
            setOpen(false);
            setMessage("Address suggestions are temporarily unavailable. You can enter the full address manually below.");
          }
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    }, 260);

    return () => window.clearTimeout(timer);
  }, [apiKey, query]);

  async function choosePrediction(prediction: GooglePlacePrediction) {
    setLoading(true);
    setOpen(false);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] });
      const address = cleanFormattedAddress(place.formattedAddress);
      const postcode = postcodeFromComponents(place.addressComponents);
      if (!address) throw new Error("Missing address");
      onSelect({ address, postcode });
      setQuery(address);
      setSuggestions([]);
      setMessage(postcode ? `Address selected — postcode ${postcode} filled automatically.` : "Address selected.");
      const places = placesRef.current;
      tokenRef.current = places ? new places.AutocompleteSessionToken() : null;
    } catch {
      setMessage("We could not read that result. Please enter the full address manually below.");
    } finally {
      setLoading(false);
    }
  }

  const helperText = !apiKey
    ? "Address suggestions are unavailable. Enter the full address manually below."
    : message || "Type a house number or street. If you entered a postcode above, it is automatically used to narrow the search.";

  return (
    <div className="relative mt-3 min-w-0 max-w-full">
      <div className="relative min-w-0 max-w-full">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5f7690]" />
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          aria-label="Search for your UK address"
          aria-expanded={open}
          aria-controls="primeview-address-suggestions"
          placeholder="House number or street"
          value={query}
          onFocus={() => suggestions.length && setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage("");
            if (!event.target.value.trim()) {
              requestIdRef.current += 1;
              setSuggestions([]);
              setOpen(false);
              setLoading(false);
            }
          }}
          className="min-h-12 w-full min-w-0 max-w-full rounded-xl border border-[#cbd8e6] bg-white py-3 pl-12 pr-11 text-[16px] text-[#0b2a4a] outline-none transition placeholder:text-[#7b8da1] focus:border-[#2f80ed] focus:ring-4 focus:ring-[#2f80ed]/10"
        />
        {loading ? <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#1769c2]" /> : null}
      </div>

      {open && suggestions.length ? (
        <div id="primeview-address-suggestions" role="listbox" className="absolute z-50 mt-2 max-h-72 w-full min-w-0 max-w-full overflow-y-auto rounded-2xl border border-[#cbd8e6] bg-white p-1.5 shadow-[0_18px_45px_rgba(11,42,74,.18)]">
          {suggestions.map((prediction, index) => {
            const label = predictionText(prediction);
            return (
              <button
                key={`${label.main}-${label.secondary}-${index}`}
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void choosePrediction(prediction)}
                className="flex w-full min-w-0 items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#eef6ff] focus:bg-[#eef6ff]"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1769c2]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#183e63]">{label.main}</span>
                  {label.secondary ? <span className="mt-0.5 block truncate text-xs text-[#667b91]">{label.secondary}</span> : null}
                </span>
              </button>
            );
          })}
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#8a9aac]">Powered by Google</p>
        </div>
      ) : null}

      <p className={`mt-2 text-xs leading-5 ${message || !apiKey ? "font-semibold text-[#667b91]" : "text-[#667b91]"}`}>{helperText}</p>
    </div>
  );
}
