import type { PublicLocale } from "@/lib/public-locale";

export const directoryProfileCopy = {
  sv: {
    language: "EN English", official: "Officiella företagsdata", claim: "Äger du företaget?",
    industry: "Bransch", status: "Status", quality: "Datakvalitet", active: "Aktiv organisation", checked: "Automatiskt datakontrollerad",
    about: "Om verksamheten", details: "Företagsuppgifter", legalForm: "Företagsform", city: "Ort", municipality: "Kommun", address: "Adress",
    services: "Tjänster på profilen", serviceSni: "Baserad på SNI", serviceConfirmed: "Bekräftad", servicePublic: "Publicerad tjänst",
    serviceAreas: "Bekräftat serviceområde", generalArea: "Generellt serviceområde", radius: "radie",
    similarTitle: "Behöver du hjälp inom samma område?", similarLead: "Se andra publicerade företag som matchar samma tjänst och ort.", similarCta: "Hitta liknande företag",
    sourceTitle: "Var kommer informationen från?", sourceLead: "Grunduppgifterna kommer från officiell företagsdata och kvalitetssäkras automatiskt av Proffera.",
    sourceOwner: "Detta betyder inte att företagets ägare har verifierat eller gjort anspråk på profilen.", noImage: "Ingen företagsbild visas förrän en verifierad bild finns tillgänglig.",
    lastChecked: "Senast kontrollerad", synced: "kontrollerad vid senaste synk", fallbackCategory: "Tjänsteföretag",
  },
  en: {
    language: "SV Svenska", official: "Official company data", claim: "Claim this business",
    industry: "Industry", status: "Status", quality: "Data quality", active: "Active organisation", checked: "Automatically data-checked",
    about: "Official business description (Swedish)", details: "Company details", legalForm: "Legal form", city: "City", municipality: "Municipality", address: "Address",
    services: "Services on this profile", serviceSni: "Based on SNI", serviceConfirmed: "Confirmed", servicePublic: "Published service",
    serviceAreas: "Confirmed service area", generalArea: "General service area", radius: "radius",
    similarTitle: "Need help with a similar service?", similarLead: "See other published companies that match the same service and location.", similarCta: "Find similar companies",
    sourceTitle: "Where does this information come from?", sourceLead: "Core details come from official Swedish company data and are automatically quality-checked by Proffera.",
    sourceOwner: "This does not mean the business owner has verified or claimed the profile.", noImage: "No business image is shown until a verified image is available.",
    lastChecked: "Last checked", synced: "checked during the latest sync", fallbackCategory: "Service business",
  },
} as const satisfies Record<PublicLocale, Record<string, string>>;
