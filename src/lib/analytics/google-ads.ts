import { sanitizeAnalyticsPathname } from "./posthog-privacy";

export const PRIMEVIEW_GOOGLE_ADS_TAG_ID = "AW-18438705476";
export const PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID = "primeview-google-ads-gtag";

const PRIMEVIEW_BOOKING_PATH = "/booking";
const PRIMEVIEW_BOOKING_SUCCESS_PARAM = "booked";
const PRIMEVIEW_BOOKING_SUCCESS_VALUE = "1";

type SearchParamsLike = Pick<URLSearchParams, "get">;

export type PrimeViewGoogleAdsPageView = {
  pageLocation: string;
  pagePath: string;
  isBookingConversion: boolean;
};

export function isPrimeViewBookingConversionPage(
  pathname: string,
  searchParams: SearchParamsLike,
) {
  return (
    sanitizeAnalyticsPathname(pathname) === PRIMEVIEW_BOOKING_PATH
    && searchParams.get(PRIMEVIEW_BOOKING_SUCCESS_PARAM) === PRIMEVIEW_BOOKING_SUCCESS_VALUE
  );
}

export function buildPrimeViewGoogleAdsPageView(
  origin: string,
  pathname: string,
  searchParams: SearchParamsLike,
): PrimeViewGoogleAdsPageView | null {
  let safeOrigin: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    safeOrigin = url.origin;
  } catch {
    return null;
  }

  const safePathname = sanitizeAnalyticsPathname(pathname || "/");
  const isBookingConversion = isPrimeViewBookingConversionPage(safePathname, searchParams);
  const pagePath = isBookingConversion
    ? `${PRIMEVIEW_BOOKING_PATH}?${PRIMEVIEW_BOOKING_SUCCESS_PARAM}=${PRIMEVIEW_BOOKING_SUCCESS_VALUE}`
    : safePathname;

  return {
    pageLocation: `${safeOrigin}${pagePath}`,
    pagePath,
    isBookingConversion,
  };
}
