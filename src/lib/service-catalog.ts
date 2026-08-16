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
} as const;

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
