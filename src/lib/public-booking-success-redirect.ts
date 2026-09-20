export type PublicBookingSuccessLocale = "sv" | "en";

/** Returns the public success URL used immediately after a verified booking is created. */
export function publicBookingSuccessRedirect(
  slug: string,
  locale: PublicBookingSuccessLocale,
) {
  if (slug === "primeview") return "/booking?booked=1";
  return `/boka/${slug}?booked=1${locale === "en" ? "&lang=en" : ""}`;
}
