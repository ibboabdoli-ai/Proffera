"use client";

import { useSearchParams } from "next/navigation";

const benefitCopy = {
  sv: [
    ["Enkel onlinebokning", "Boka bord på några sekunder"],
    ["Flexibel ändring", "Hantera din bokning enkelt"],
    ["Tydlig överblick", "Se tider och bokningsinformation på ett ställe"],
    ["Säker och trygg", "Dina uppgifter hanteras säkert"],
  ],
  en: [
    ["Simple online booking", "Book a table in seconds"],
    ["Flexible changes", "Manage your booking easily"],
    ["Clear overview", "See times and booking information in one place"],
    ["Safe and secure", "Your details are handled securely"],
  ],
} as const;

type RestaurantBookingBenefitsProps = {
  defaultLanguage: "sv" | "en";
  swedishEnabled: boolean;
  englishEnabled: boolean;
};

export function RestaurantBookingBenefits({
  defaultLanguage,
  swedishEnabled,
  englishEnabled,
}: RestaurantBookingBenefitsProps) {
  const searchParams = useSearchParams();
  const requestedLanguage = searchParams.get("lang") === "en" ? "en" : searchParams.get("lang") === "sv" ? "sv" : defaultLanguage;
  const locale = requestedLanguage === "en" && englishEnabled
    ? "en"
    : requestedLanguage === "sv" && swedishEnabled
      ? "sv"
      : englishEnabled
        ? "en"
        : "sv";

  return (
    <div className="restaurant-v3-feature-strip" aria-label={locale === "en" ? "Booking benefits" : "Bokningsfördelar"}>
      {benefitCopy[locale].map(([title, description]) => (
        <div key={title}><strong>{title}</strong><span>{description}</span></div>
      ))}
    </div>
  );
}
