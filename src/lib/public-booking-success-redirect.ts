export type PublicBookingSuccessLocale = "sv" | "en";

/** Returns the public success URL used immediately after a verified booking is created. */
export function publicBookingSuccessRedirect(
  slug: string,
  locale: PublicBookingSuccessLocale,
) {
  if (slug === "primeview") return "/booking?booked=1";
  // Maria's approved photo-free Design 02 is the customer booking surface.
  // Keep her success page on the same design in Preview only.
  if (slug === "makeup-by-maria" && process.env.VERCEL_ENV === "preview") {
    return `/demo/makeup-by-maria-v2.html?booked=1&lang=${locale}`;
  }
  return `/boka/${slug}?booked=1&lang=${locale}`;
}
