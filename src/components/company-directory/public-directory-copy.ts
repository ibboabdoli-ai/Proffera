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
    language: "EN English", eyebrow: "Företagskatalog", title: "Hitta rätt företag för jobbet",
    intro: "Sök efter tjänst och ort, eller använd din position för att hitta publicerade företag nära dig.",
    service: "Tjänst", servicePlaceholder: "t.ex. Rörmokare eller Fönsterputsning", location: "Ort",
    locationPlaceholder: "t.ex. Stockholm", search: "Sök", nearby: "Nära mig", loading: "Hämtar…",
    noGeo: "Din webbläsare stöder inte platsdelning.", locating: "Hämtar din position…",
    found: "Position hittad. Söker nära dig…", geoError: "Kunde inte läsa din position. Kontrollera webbläsarens platsbehörighet.",
    addressNotice: "Platsen i sökningen baseras på företagets registrerade adress. Det betyder inte automatiskt att företaget erbjuder tjänsten i hela området.",
    nearbyNotice: (radius: number) => `Nära mig visar endast publicerade företag med verifierad position inom ${radius} km.`,
    popular: "Populära tjänster", popularLead: "Välj en tjänst för att komma igång direkt.",
    badPosition: "Positionen kunde inte tolkas. Prova Nära mig igen eller sök med ort.",
    badService: "Tjänsten känns inte igen ännu. Välj gärna ett förslag i listan eller prova en bredare tjänst.",
    results: "Sökresultat", companyCount: (count: number) => `${count} företag`, nearest: (radius: number) => `Närmaste först · ${radius} km`,
    publishedOnly: "Endast publicerade profiler · max 30", officialData: "Officiella företagsdata", away: (km: number) => `${km.toFixed(1)} km bort`,
    viewProfile: "Visa profil", empty: "Inga publicerade företag hittades för den här sökningen ännu.",
    emptyNearby: (radius: number) => `Inga publicerade företag med verifierad position hittades inom ${radius} km ännu.`,
    sourceDescription: "Officiell verksamhetsbeskrivning", country: "Sverige",
  },
  en: {
    language: "SV Svenska", eyebrow: "Business directory", title: "Find the right company for the job",
    intro: "Search by service and location, or use your position to find published companies near you.",
    service: "Service", servicePlaceholder: "e.g. Plumber or Window cleaning", location: "Location",
    locationPlaceholder: "e.g. Stockholm", search: "Search", nearby: "Near me", loading: "Locating…",
    noGeo: "Your browser does not support location sharing.", locating: "Getting your position…",
    found: "Position found. Searching near you…", geoError: "We could not read your position. Check your browser location permission.",
    addressNotice: "Location search is based on the company's registered address. This does not automatically mean the company serves the entire area.",
    nearbyNotice: (radius: number) => `Near me only shows published companies with a verified position within ${radius} km.`,
    popular: "Popular services", popularLead: "Choose a service to get started.",
    badPosition: "The position could not be interpreted. Try Near me again or search by location.",
    badService: "We do not recognise that service yet. Choose a suggestion or try a broader service.",
    results: "Search results", companyCount: (count: number) => `${count} ${count === 1 ? "company" : "companies"}`, nearest: (radius: number) => `Nearest first · ${radius} km`,
    publishedOnly: "Published profiles only · max 30", officialData: "Official company data", away: (km: number) => `${km.toFixed(1)} km away`,
    viewProfile: "View profile", empty: "No published companies were found for this search yet.",
    emptyNearby: (radius: number) => `No published companies with a verified position were found within ${radius} km yet.`,
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
