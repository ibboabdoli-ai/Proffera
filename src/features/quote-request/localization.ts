import type { PublicLocale } from "@/lib/public-locale";
import { quoteCategoryEnglishLabel } from "@/lib/service-catalog";

export const quoteRequestPaths = { sv: "/fa-offert", en: "/en/get-quote" } as const;

export const preferredDateValues = ["Så snart som möjligt", "Inom 1 vecka", "Inom 1 månad", "Jag är flexibel"] as const;

const serviceEn: Record<string, string> = {
  "Städning / lokalvård": "Cleaning / janitorial services", "Hemstädning": "Home cleaning", "Kontorsstädning": "Office cleaning",
  "Flyttstädning": "Move-out cleaning", "Fönsterputsning": "Window cleaning", "Byggstädning": "Post-construction cleaning", "Annan städning": "Other cleaning",
  "VVS / rörmokare": "Plumbing / plumber", "Avloppsrensning": "Drain cleaning", "Vattenläcka": "Water leak", "Värmepump": "Heat pump", "Annat VVS-arbete": "Other plumbing work",
  "Elinstallation": "Electrical installation", "Felsökning el": "Electrical troubleshooting", "Laddbox": "EV charger", "Elcentral": "Electrical panel", "Annat elarbete": "Other electrical work",
  "Målning": "Painting", "Tapetsering": "Wallpapering", "Annat måleriarbete": "Other painting work",
  "Snickeri": "Carpentry", "Montering": "Installation / assembly", "Mindre byggarbete": "Minor building work", "Annat snickeriarbete": "Other carpentry work",
  "Hemservice": "Home services", "Hushållsnära tjänst": "Household service", "Annat hemservicearbete": "Other home service",
  "Engångsstädning": "One-time cleaning", "Återkommande städning": "Recurring cleaning", "Storstädning": "Deep cleaning",
  "Lägenhet": "Apartment", "Villa": "House", "Kontor": "Office", "Litet kontor": "Small office", "Medelstort kontor": "Medium office", "Större lokal": "Large premises", "Lokal": "Premises",
  "Efter renovering": "After renovation", "Efter nyproduktion": "After new construction", "Grovstädning": "Rough cleaning",
  "Gräsklippning": "Lawn mowing", "Häckklippning": "Hedge trimming", "Trädgårdsskötsel": "Garden maintenance",
  "Bärhjälp": "Carrying help", "Flytt med transport": "Moving with transport", "Packhjälp": "Packing help",
  "Golv": "Flooring", "Mindre renovering": "Minor renovation",
};

const dateEn: Record<string, string> = {
  "Så snart som möjligt": "As soon as possible", "Inom 1 vecka": "Within 1 week", "Inom 1 månad": "Within 1 month", "Jag är flexibel": "I'm flexible",
};

export function quoteCategoryLabel(value: string, locale: PublicLocale) { return locale === "en" ? quoteCategoryEnglishLabel(value) ?? value : value; }
export function quoteServiceTypeLabel(value: string, locale: PublicLocale) { return locale === "en" ? serviceEn[value] ?? value : value; }
export function quotePreferredDateLabel(value: string, locale: PublicLocale) { return locale === "en" ? dateEn[value] ?? value : value; }
