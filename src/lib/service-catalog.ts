export const quoteServiceTypesByCategory = {
  "Städning": ["Städning / lokalvård", "Hemstädning", "Kontorsstädning", "Flyttstädning", "Fönsterputsning", "Byggstädning", "Annan städning"],
  "VVS": ["VVS / rörmokare", "Avloppsrensning", "Vattenläcka", "Värmepump", "Annat VVS-arbete"],
  "Elektriker": ["Elinstallation", "Felsökning el", "Laddbox", "Elcentral", "Annat elarbete"],
  "Måleri": ["Målning", "Tapetsering", "Annat måleriarbete"],
  "Snickeri": ["Snickeri", "Montering", "Mindre byggarbete", "Annat snickeriarbete"],
  "Hemservice": ["Hemservice", "Hushållsnära tjänst", "Annat hemservicearbete"],
  "Hemstädning": ["Engångsstädning", "Återkommande städning", "Storstädning"],
  "Flyttstädning": ["Lägenhet", "Villa", "Kontor"],
  "Kontorsstädning": ["Litet kontor", "Medelstort kontor", "Större lokal"],
  "Fönsterputs": ["Lägenhet", "Villa", "Lokal"],
  "Byggstädning": ["Efter renovering", "Efter nyproduktion", "Grovstädning"],
  "Trädgård": ["Gräsklippning", "Häckklippning", "Trädgårdsskötsel"],
  "Flytthjälp": ["Bärhjälp", "Flytt med transport", "Packhjälp"],
  "Renovering": ["Målning", "Golv", "Mindre renovering"],
} as const;

export type ServiceCatalogQuoteCategory = keyof typeof quoteServiceTypesByCategory;

export const quoteCategoryLabelsEn = {
  "Städning": "Cleaning",
  "VVS": "Plumbing",
  "Elektriker": "Electrician",
  "Måleri": "Painting",
  "Snickeri": "Carpentry",
  "Hemservice": "Home services",
  "Hemstädning": "Home cleaning",
  "Flyttstädning": "Move-out cleaning",
  "Kontorsstädning": "Office cleaning",
  "Fönsterputs": "Window cleaning",
  "Byggstädning": "Post-construction cleaning",
  "Trädgård": "Gardening",
  "Flytthjälp": "Moving help",
  "Renovering": "Renovation",
} as const satisfies Record<ServiceCatalogQuoteCategory, string>;

export const serviceCategoryCatalog = {
  stadning: {
    labels: { sv: "Städning", en: "Cleaning" },
    quoteCategories: ["Städning", "Hemstädning", "Flyttstädning", "Kontorsstädning", "Fönsterputs", "Byggstädning"],
  },
  flytt: {
    labels: { sv: "Flytt", en: "Moving" },
    quoteCategories: ["Flytthjälp"],
  },
  elektriker: {
    labels: { sv: "Elektriker", en: "Electrician" },
    quoteCategories: ["Elektriker"],
  },
  vvs: {
    labels: { sv: "VVS", en: "Plumbing" },
    quoteCategories: ["VVS"],
  },
  maleri: {
    labels: { sv: "Måleri", en: "Painting" },
    quoteCategories: ["Måleri"],
  },
  snickeri: {
    labels: { sv: "Snickeri", en: "Carpentry" },
    quoteCategories: ["Snickeri"],
  },
  tradgard: {
    labels: { sv: "Trädgård", en: "Gardening" },
    quoteCategories: ["Trädgård"],
  },
  hemservice: {
    labels: { sv: "Hemservice", en: "Home services" },
    quoteCategories: ["Hemservice"],
  },
  frisor: {
    labels: { sv: "Frisör", en: "Hairdresser" },
    quoteCategories: [],
  },
} as const satisfies Record<string, {
  labels: Record<"sv" | "en", string>;
  quoteCategories: readonly ServiceCatalogQuoteCategory[];
}>;

export type ServiceCategorySlug = keyof typeof serviceCategoryCatalog;
export type ServiceCatalogLocale = "sv" | "en";

export const serviceCategorySlugs = Object.freeze(
  Object.keys(serviceCategoryCatalog) as ServiceCategorySlug[],
);

export function serviceCategoryLabel(slug: ServiceCategorySlug, locale: ServiceCatalogLocale) {
  return serviceCategoryCatalog[slug].labels[locale];
}

export function serviceCategoryForQuoteCategory(quoteCategory: string): ServiceCategorySlug | null {
  for (const slug of serviceCategorySlugs) {
    const quoteCategories = serviceCategoryCatalog[slug].quoteCategories as readonly string[];
    if (quoteCategories.includes(quoteCategory)) return slug;
  }
  return null;
}

export function quoteCategoryEnglishLabel(value: string) {
  if (!Object.hasOwn(quoteCategoryLabelsEn, value)) return undefined;
  return quoteCategoryLabelsEn[value as ServiceCatalogQuoteCategory];
}
