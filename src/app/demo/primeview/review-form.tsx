"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Star } from "lucide-react";

type PrimeViewReviewFormProps = {
  serviceOptions: readonly string[];
};

type GoogleAuthorAttribution = {
  displayName?: string;
  uri?: string;
  photoURI?: string;
};

type GoogleReview = {
  authorAttribution?: GoogleAuthorAttribution;
  rating?: number;
  text?: string;
  relativePublishTimeDescription?: string;
  googleMapsURI?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: GoogleReview[];
  googleMapsURI?: string;
};

type GooglePlaceClass = {
  searchByText: (request: {
    textQuery: string;
    fields: string[];
    language?: string;
    region?: string;
    maxResultCount?: number;
    pureServiceAreaBusinessesIncluded?: boolean;
    locationBias?: { center: { lat: number; lng: number }; radius: number };
  }) => Promise<{ places: GooglePlace[] }>;
};

type GooglePlacesLibrary = {
  Place: GooglePlaceClass;
};

type PrimeViewWindow = Window & {
  google?: {
    maps: {
      importLibrary: (library: "places") => Promise<GooglePlacesLibrary>;
    };
  };
  __primeViewGoogleMapsPromise?: Promise<void>;
};

const GOOGLE_SCRIPT_SELECTOR = 'script[data-primeview-google-maps="true"]';
const PRIMEVIEW_NAME = "primeview window care";

function primeViewWindow() {
  return window as PrimeViewWindow;
}

function loadGoogleMaps(apiKey: string) {
  const target = primeViewWindow();
  if (target.google?.maps?.importLibrary) return Promise.resolve();
  if (target.__primeViewGoogleMapsPromise) return target.__primeViewGoogleMapsPromise;

  target.__primeViewGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(GOOGLE_SCRIPT_SELECTOR);
    if (existing) {
      if (primeViewWindow().google?.maps?.importLibrary) {
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

  return target.__primeViewGoogleMapsPromise;
}

function normalizedName(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1 text-[#f4b400]" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={size} fill={index < rounded ? "currentColor" : "none"} aria-hidden="true" />
      ))}
    </span>
  );
}

export function PrimeViewReviewForm({ serviceOptions }: PrimeViewReviewFormProps) {
  void serviceOptions;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const [place, setPlace] = useState<GooglePlace | null>(null);
  const [loading, setLoading] = useState(Boolean(apiKey));
  const [failed, setFailed] = useState(!apiKey);

  useEffect(() => {
    if (!apiKey) return;
    let disposed = false;

    void loadGoogleMaps(apiKey)
      .then(async () => {
        const googleMaps = primeViewWindow().google;
        if (!googleMaps?.maps?.importLibrary) throw new Error("Google Maps is unavailable.");
        const { Place } = await googleMaps.maps.importLibrary("places");
        const { places } = await Place.searchByText({
          textQuery: "PrimeView Window Care London +44 7500 338585",
          fields: ["id", "displayName", "rating", "userRatingCount", "reviews", "googleMapsURI"],
          language: "en-GB",
          region: "gb",
          maxResultCount: 5,
          pureServiceAreaBusinessesIncluded: true,
          locationBias: { center: { lat: 51.515, lng: -0.18 }, radius: 40_000 },
        });

        const exact = places.find((item) => normalizedName(item.displayName) === PRIMEVIEW_NAME) ?? null;
        if (!disposed) {
          setPlace(exact);
          setFailed(!exact);
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [apiKey]);

  const reviews = useMemo(() => (place?.reviews ?? []).filter((review) => Boolean(review.text)).slice(0, 3), [place]);
  const googleUrl = place?.googleMapsURI ?? "https://www.google.com/maps/search/?api=1&query=PrimeView%20Window%20Care%20London";

  if (loading) {
    return (
      <section className="rounded-2xl border border-[#cbd9ef] bg-[#f6f9ff] p-6 text-[#29436f]">
        <div className="flex items-center gap-3 text-sm font-black text-[#0a3c8f]">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Loading Google Reviews…
        </div>
      </section>
    );
  }

  if (failed || !place) {
    return (
      <section className="rounded-2xl border border-[#cbd9ef] bg-[#f6f9ff] p-6 text-[#29436f]">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-[#0a3c8f]">Google Reviews</p>
        <h3 className="mt-3 text-xl font-black text-[#071b42]">PrimeView on Google</h3>
        <p className="mt-3 text-sm leading-6">Google Reviews are temporarily unavailable here. You can still open the PrimeView profile on Google Maps.</p>
        <a href={googleUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black !text-white hover:bg-[#061b42]">
          Open Google Maps <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#cbd9ef] bg-[#f6f9ff] p-5 text-[#29436f] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#0a3c8f]">Google Reviews</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-[#071b42]">What customers say on Google</h3>
        </div>
        <span translate="no" className="whitespace-nowrap text-xs font-normal text-[#5e5e5e]">Google Maps</span>
      </div>

      {typeof place.rating === "number" ? (
        <div className="mt-5 rounded-2xl border border-[#d7e1f2] bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-black text-[#071b42]">{place.rating.toFixed(1)}</span>
            <Stars rating={place.rating} />
            {typeof place.userRatingCount === "number" ? <span className="text-sm font-semibold text-slate-500">({place.userRatingCount} reviews)</span> : null}
          </div>
        </div>
      ) : null}

      {reviews.length ? (
        <div className="mt-4 grid gap-3">
          {reviews.map((review, index) => {
            const author = review.authorAttribution;
            return (
              <article key={`${author?.displayName ?? "review"}-${index}`} className="rounded-2xl border border-[#d7e1f2] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {author?.photoURI ? (
                      <span aria-hidden="true" className="size-9 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(author.photoURI)})` }} />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef3fc] text-sm font-black text-[#315997]">G</span>
                    )}
                    <div className="min-w-0">
                      {author?.uri ? (
                        <a href={author.uri} target="_blank" rel="noreferrer" className="block truncate text-sm font-black text-[#071b42] hover:underline">{author.displayName || "Google customer"}</a>
                      ) : (
                        <p className="truncate text-sm font-black text-[#071b42]">{author?.displayName || "Google customer"}</p>
                      )}
                      {review.relativePublishTimeDescription ? <p className="mt-0.5 text-xs text-slate-500">{review.relativePublishTimeDescription}</p> : null}
                    </div>
                  </div>
                  {typeof review.rating === "number" ? <Stars rating={review.rating} size="size-3.5" /> : null}
                </div>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{review.text}</p>
                {review.googleMapsURI ? (
                  <a href={review.googleMapsURI} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0a3c8f] hover:underline">
                    View this review on Google Maps <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-[#d7e1f2] bg-white p-4 text-sm leading-6 text-slate-600">Open Google Maps to read the latest PrimeView customer reviews.</p>
      )}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">Showing up to 3 reviews returned by Google Maps, ordered by relevance. Google checks reviews for policy violations but does not verify individual customer experiences.</p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <a href={googleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a3c8f] px-4 py-3 text-sm font-black !text-white hover:bg-[#061b42]">
          View all reviews <ExternalLink className="size-4" aria-hidden="true" />
        </a>
        <a href={googleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#9fb9e2] bg-white px-4 py-3 text-sm font-black text-[#0a3c8f] hover:bg-[#eef4ff]">
          Leave a Google review <Star className="size-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
