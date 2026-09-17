export const PRIMEVIEW_GOOGLE_ADS_TAG_ID = "AW-18438705476";
export const PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID = "primeview-google-ads-tag";

export type GoogleAdsConsentState = "granted" | "denied";

export function isPrimeViewBookingConversionPath(
  pathname: string | null | undefined,
  booked: string | null | undefined,
) {
  return pathname === "/booking" && booked === "1";
}

export function buildPrimeViewGoogleAdsPageLocation(
  origin: string,
  pathname: string | null | undefined,
  booked: string | null | undefined,
) {
  const safePathname = pathname && pathname.startsWith("/") ? pathname : "/";
  const base = `${origin.replace(/\/$/, "")}${safePathname}`;
  return isPrimeViewBookingConversionPath(safePathname, booked)
    ? `${base}?booked=1`
    : base;
}

export function googleAdsConsentCommand(consent: GoogleAdsConsentState) {
  if (consent === "granted") {
    return {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "denied",
    } as const;
  }

  return {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  } as const;
}
