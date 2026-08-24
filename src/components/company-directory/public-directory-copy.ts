import type { PublicLocale } from "@/lib/public-locale";
import { serviceCategoryCatalog } from "@/lib/service-catalog";

export const directoryPaths = {
  sv: { search: "/foretag/listad", home: "/" },
  en: { search: "/en/companies", home: "/en" },
} as const;

export const directoryServiceLabelsEn: Record<string, string> = {
  vvs: "Plumber / Plumbing",
  avloppsrensning: "Drain cleaning",
  vattenlacka: "Water leak",
  varmepump: "Heat pump",
  elinstallation: "Electrician",
  "felsokning-el": "Electrical troubleshooting",
  laddbox: "EV charger",
  elcentral: "Electrical panel",
  lokalvard: "Cleaning",
  hemstadning: "Home cleaning",
  kontorsstadning: "Office cleaning",
  flyttstadning: "Move-out cleaning",
  fonsterputsning: "Window cleaning",
  malning: "Painting",
  snickeri: "Carpentry",
  flytthjalp: "Moving help",
  tradgardshjalp: "Gardening",
  hemservice: "Home services",
  frisor: "Hairdresser / Barber",
};

const directoryServiceQueriesEn: Record<string, string> = {
  plumber: "vvs",
  "plumber / plumbing": "vvs",
  plumbing: "vvs",
  "drain cleaning": "avloppsrensning",
  "water leak": "vattenlacka",
  "heat pump": "varmepump",
  electrician: "elinstallation",
  "electrical troubleshooting": "felsokning-el",
  "ev charger": "laddbox",
  "electrical panel": "elcentral",
  cleaning: "lokalvard",
  "home cleaning": "hemstadning",
  "office cleaning": "kontorsstadning",
  "move-out cleaning": "flyttstadning",
  "window cleaning": "fonsterputsning",
  painting: "malning",
  painter: "malning",
  carpentry: "snickeri",
  carpenter: "snickeri",
  "moving help": "flytthjalp",
  gardening: "tradgardshjalp",
  "home services": "hemservice",
  hairdresser: "frisor",
  barber: "frisor",
  "hairdresser / barber": "frisor",
};

function categoryLabelsForLocale(locale: PublicLocale): Record<string, string> {
  return Object.fromEntries(
    Object.entries(serviceCategoryCatalog).map(([slug, category]) => [slug, category.labels[locale]]),
  );
}

export const directoryCategoryLabels: Record<PublicLocale, Record<string, string>> = {
  sv: categoryLabelsForLocale("sv"),
  en: categoryLabelsForLocale("en"),
};

export const popularDirectoryServices = [
  { query: "vvs", sv: "Rörmokare", en: "Plumber" },
  { query: "elinstallation", sv: "Elektriker", en: "Electrician" },
  { query: "lokalvard", sv: "Städning", en: "Cleaning" },
  { query: "fonsterputsning", sv: "Fönsterputsning", en: "Window cleaning" },
  { query: "malning", sv: "Målare", en: "Painter" },
  { query: "snickeri", sv: "Snickare", en: "Carpenter" },
  { query: "flytthjalp", sv: "Flytthjälp", en: "Moving help" },
  { query: "tradgardshjalp", sv: "Trädgård", en: "Gardening" },
] as const;

export const directoryCopy = {
  sv: {
    language: "EN English", eyebrow: "Hitta företag", title: "Hitta rätt företag för jobbet",
    intro: "Sök tjänst och ort. Där det är tillgängligt kan du boka tid eller begära offert direkt.",
    service: "Tjänst", servicePlaceholder: "t.ex. Frisör, elektriker eller städning", location: "Ort",
    locationPlaceholder: "t.ex. Södertälje", search: "Sök", nearby: "Nära mig", loading: "Hämtar…",
    noGeo: "Din webbläsare stöder inte platsdelning.", locating: "Hämtar din position…",
    found: "Position hittad. Söker nära dig…", geoError: "Kunde inte läsa din position. Kontrollera webbläsarens platsbehörighet.",
    addressNotice: "Ortssökning utgår från företagets registrerade ort. Bekräftat serviceområde visas separat.",
    nearbyNotice: (radius: number) => `Nära mig visar företag med verifierad position inom ${radius} km. Bekräftat serviceområde visas separat.`,
    popular: "Populära tjänster", popularLead: "Välj en tjänst för att komma igång direkt.",
    badPosition: "Positionen kunde inte tolkas. Prova Nära mig igen eller sök med ort.",
    badService: "Tjänsten känns inte igen ännu. Välj gärna ett förslag i listan eller prova en bredare tjänst.",
    results: "Företag som matchar", companyCount: (count: number) => `${count} ${count === 1 ? "företag matchar" : "företag matchar"} din sökning`, nearest: (radius: number) => `Närmaste först · ${radius} km`, withinRadius: (radius: number) => `Verifierad position · inom ${radius} km`,
    sortBy: "Sortera", sortRecommended: "Rekommenderade", sortNearest: "Närmaste", sortName: "A–Ö",
    range: (from: number, to: number, total: number) => `Visar ${from}–${to} av ${total} företag`, pagination: "Sidnavigering", previous: "Föregående", next: "Nästa", pageLabel: (page: number) => `Sida ${page}`,
    publishedOnly: "Verifierade företagsprofiler", officialData: "Officiella företagsdata", verifiedDetails: "Företagsuppgifter verifierade", away: (km: number) => `${km.toFixed(1)} km bort`,
    registeredIn: (location: string) => `Registrerad i ${location}`,
    serviceAreaMatch: "Bekräftat serviceområde matchar din position.",
    profferaBusiness: "Tjänsten är aktiv på Proffera", viewProfile: "Se företag", viewCompany: "Se företag", viewService: "Se tjänst",
    book: "Boka tid", requestQuote: "Begär offert", contact: "Kontakta",
    compareQuotes: "Vill du jämföra flera företag?", compareQuotesLead: "Skicka en förfrågan en gång och få hjälp att hitta lämpliga företag.", getQuotes: "Få offerter",
    tryPopular: "Prova en populär tjänst", browseAll: "Visa alla tjänster", searchAllSweden: "Sök i hela Sverige", alternativeTitle: "Kom vidare med ditt ärende",
    alternativeLead: "Bredda sökningen eller beskriv jobbet en gång så hjälper Proffera dig att hitta lämpliga företag.",
    empty: "Inga företag hittades för den här sökningen ännu.",
    emptyNearby: (radius: number) => `Inga företag med verifierad position hittades inom ${radius} km ännu.`,
    sourceDescription: "Officiell verksamhetsbeskrivning", country: "Sverige",
  },
  en: {
    language: "SV Svenska", eyebrow: "Find businesses", title: "Find the right company for the job",
    intro: "Search by service and location. Where available, you can book or request a quote directly.",
    service: "Service", servicePlaceholder: "e.g. Hairdresser, electrician or cleaning", location: "Location",
    locationPlaceholder: "e.g. Södertälje", search: "Search", nearby: "Near me", loading: "Locating…",
    noGeo: "Your browser does not support location sharing.", locating: "Getting your position…",
    found: "Position found. Searching near you…", geoError: "We could not read your position. Check your browser location permission.",
    addressNotice: "Location search uses the business's registered location. Confirmed service area is shown separately.",
    nearbyNotice: (radius: number) => `Near me shows businesses with a verified position within ${radius} km. Confirmed service area is shown separately.`,
    popular: "Popular services", popularLead: "Choose a service to get started.",
    badPosition: "The position could not be interpreted. Try Near me again or search by location.",
    badService: "We do not recognise that service yet. Choose a suggestion or try a broader service.",
    results: "Matching businesses", companyCount: (count: number) => `${count} ${count === 1 ? "business matches" : "businesses match"} your search`, nearest: (radius: number) => `Nearest first · ${radius} km`, withinRadius: (radius: number) => `Verified position · within ${radius} km`,
    sortBy: "Sort", sortRecommended: "Recommended", sortNearest: "Nearest", sortName: "A–Z",
    range: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total} businesses`, pagination: "Pagination", previous: "Previous", next: "Next", pageLabel: (page: number) => `Page ${page}`,
    publishedOnly: "Verified business profiles", officialData: "Official company data", verifiedDetails: "Company details verified", away: (km: number) => `${km.toFixed(1)} km away`,
    registeredIn: (location: string) => `Registered in ${location}`,
    serviceAreaMatch: "Confirmed service area matches your position.",
    profferaBusiness: "Service active on Proffera", viewProfile: "View business", viewCompany: "View business", viewService: "View service",
    book: "Book appointment", requestQuote: "Request quote", contact: "Contact",
    compareQuotes: "Want to compare several businesses?", compareQuotesLead: "Send one request and get help finding suitable businesses.", getQuotes: "Get quotes",
    tryPopular: "Try a popular service", browseAll: "View all services", searchAllSweden: "Search all of Sweden", alternativeTitle: "Keep your project moving", alternativeLead: "Broaden the search or describe the job once and Proffera will help you find suitable businesses.",
    empty: "No businesses were found for this search yet.",
    emptyNearby: (radius: number) => `No businesses with a verified position were found within ${radius} km yet.`,
    sourceDescription: "Official business description (Swedish)", country: "Sweden",
  },
} as const;

export function directoryServiceLabel(slug: string, swedishLabel: string, locale: PublicLocale) {
  return locale === "en" ? directoryServiceLabelsEn[slug] ?? swedishLabel : swedishLabel;
}

export function normalizeDirectoryPublicServiceQuery(value: string, locale: PublicLocale) {
  const trimmed = value.trim();
  if (locale !== "en") return trimmed;
  const normalized = trimmed.toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  return directoryServiceQueriesEn[normalized] ?? trimmed;
}
