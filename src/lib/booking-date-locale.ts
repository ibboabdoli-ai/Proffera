/** Calendar choices and booking references use Gregorian YYYY-MM-DD across locales. */
export type BookingDateLanguage = "sv" | "en" | "ar";

export function bookingDateLocale(language: BookingDateLanguage) {
  return language === "ar" ? "ar-SA-u-ca-gregory"
    : language === "en" ? "en-GB" : "sv-SE";
}
