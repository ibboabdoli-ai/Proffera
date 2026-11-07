/** Resolve only supported languages for Maria's dedicated Preview booking page. */
export function resolveMariaPublicBookingLocale(
  value: string | string[] | undefined,
): "sv" | "en" | "ar" {
  const requested = Array.isArray(value) ? value[0] : value;
  return requested === "en" || requested === "ar" ? requested : "sv";
}
