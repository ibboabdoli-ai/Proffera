import type { PublicLocale } from "@/lib/public-locale";

export const quoteRequestPaths = { sv: "/fa-offert", en: "/en/get-quote" } as const;

export const preferredDateValues = ["Så snart som möjligt", "Inom 1 vecka", "Inom 1 månad", "Jag är flexibel"] as const;

const categoryEn: Record<string, string> = {
  "Hemstädning": "Home cleaning",
  "Flyttstädning": "Move-out cleaning",
  "Kontorsstädning": "Office cleaning",
  "Fönsterputs": "Window cleaning",
  "Byggstädning": "Post-construction cleaning",
  "Trädgård": "Gardening",
  "Flytthjälp": "Moving help",
  "Renovering": "Renovation",
};

const serviceEn: Record<string, string> = {
  "Engångsstädning": "One-time cleaning", "Återkommande städning": "Recurring cleaning", "Storstädning": "Deep cleaning",
  "Lägenhet": "Apartment", "Villa": "House", "Kontor": "Office", "Litet kontor": "Small office", "Medelstort kontor": "Medium office", "Större lokal": "Large premises", "Lokal": "Premises",
  "Efter renovering": "After renovation", "Efter nyproduktion": "After new construction", "Grovstädning": "Rough cleaning",
  "Gräsklippning": "Lawn mowing", "Häckklippning": "Hedge trimming", "Trädgårdsskötsel": "Garden maintenance",
  "Bärhjälp": "Carrying help", "Flytt med transport": "Moving with transport", "Packhjälp": "Packing help",
  "Målning": "Painting", "Golv": "Flooring", "Mindre renovering": "Minor renovation",
};

const dateEn: Record<string, string> = {
  "Så snart som möjligt": "As soon as possible", "Inom 1 vecka": "Within 1 week", "Inom 1 månad": "Within 1 month", "Jag är flexibel": "I'm flexible",
};

export function quoteCategoryLabel(value: string, locale: PublicLocale) { return locale === "en" ? categoryEn[value] ?? value : value; }
export function quoteServiceTypeLabel(value: string, locale: PublicLocale) { return locale === "en" ? serviceEn[value] ?? value : value; }
export function quotePreferredDateLabel(value: string, locale: PublicLocale) { return locale === "en" ? dateEn[value] ?? value : value; }
