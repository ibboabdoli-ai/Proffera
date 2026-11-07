/** Resolve only supported languages for Maria's dedicated Preview booking page. */
export function resolveMariaPublicBookingLocale(
  value: string | string[] | undefined,
): "sv" | "en" | "ar" {
  const requested = Array.isArray(value) ? value[0] : value;
  return requested === "en" || requested === "ar" ? requested : "sv";
}

/** Preserve confirmed-booking success on Maria's canonical Production home. */
export function resolveMariaBookingLandingDestination(
  language: string | string[] | undefined,
  booked: boolean,
  environment: string | undefined,
): string {
  const query = `lang=${resolveMariaPublicBookingLocale(language)}${booked ? "&booked=1" : ""}`;
  return environment === "production"
    ? `https://makeupbymaria.se/?${query}`
    : `/demo/makeup-by-maria-v2.html?${query}`;
}
