export type DirectoryServiceCategoryDefinition = {
  slug: string;
  label: string;
  aliases: string[];
};

export type DirectoryServiceDefinition = {
  slug: string;
  categorySlug: string;
  parentServiceSlug: string | null;
  label: string;
  aliases: string[];
};

export const DIRECTORY_SERVICE_CATEGORIES: DirectoryServiceCategoryDefinition[] = [
  { slug: "vvs", label: "VVS", aliases: ["rörmokare", "rormokare", "rör", "ror"] },
  { slug: "elektriker", label: "Elektriker", aliases: ["el", "elservice", "elinstallatör", "elinstallator"] },
  { slug: "stadning", label: "Städning", aliases: ["städ", "stad", "städfirma", "stadfirma", "lokalvård", "lokalvard"] },
  { slug: "maleri", label: "Måleri", aliases: ["målare", "malare", "målning", "malning"] },
  { slug: "snickeri", label: "Snickeri", aliases: ["snickare", "byggnadssnickeri"] },
  { slug: "flytt", label: "Flytt", aliases: ["flyttfirma", "flytthjälp", "flytthjalp"] },
  { slug: "tradgard", label: "Trädgård", aliases: ["trädgård", "tradgard", "trädgårdshjälp", "tradgardshjalp"] },
  { slug: "hemservice", label: "Hemservice", aliases: ["hushållsnära tjänster", "hushallsnara tjanster"] },
];

export const DIRECTORY_SERVICES: DirectoryServiceDefinition[] = [
  { slug: "vvs", categorySlug: "vvs", parentServiceSlug: null, label: "VVS / Rörmokare", aliases: ["vvs", "rörmokare", "rormokare", "rör", "ror"] },
  { slug: "avloppsrensning", categorySlug: "vvs", parentServiceSlug: "vvs", label: "Avloppsrensning", aliases: ["avlopp", "stopp i avlopp", "avloppsservice"] },
  { slug: "vattenlacka", categorySlug: "vvs", parentServiceSlug: "vvs", label: "Vattenläcka", aliases: ["vattenläcka", "vattenlacka", "läckage", "lackage"] },
  { slug: "varmepump", categorySlug: "vvs", parentServiceSlug: "vvs", label: "Värmepump", aliases: ["värmepump", "varmepump"] },

  { slug: "elinstallation", categorySlug: "elektriker", parentServiceSlug: null, label: "Elinstallation", aliases: ["elektriker", "el", "elservice", "elinstallation"] },
  { slug: "felsokning-el", categorySlug: "elektriker", parentServiceSlug: "elinstallation", label: "Felsökning el", aliases: ["elfel", "felsökning el", "felsokning el"] },
  { slug: "laddbox", categorySlug: "elektriker", parentServiceSlug: "elinstallation", label: "Laddbox", aliases: ["elbilsladdare", "laddbox installation"] },
  { slug: "elcentral", categorySlug: "elektriker", parentServiceSlug: "elinstallation", label: "Elcentral", aliases: ["säkringsskåp", "sakringsskap", "centralbyte"] },

  { slug: "hemstadning", categorySlug: "stadning", parentServiceSlug: null, label: "Hemstädning", aliases: ["hemstäd", "hemstad", "städning hemma", "stadning hemma"] },
  { slug: "kontorsstadning", categorySlug: "stadning", parentServiceSlug: null, label: "Kontorsstädning", aliases: ["kontorsstäd", "kontorsstad", "lokalvård", "lokalvard"] },
  { slug: "flyttstadning", categorySlug: "stadning", parentServiceSlug: null, label: "Flyttstädning", aliases: ["flyttstäd", "flyttstad"] },
  { slug: "fonsterputsning", categorySlug: "stadning", parentServiceSlug: null, label: "Fönsterputsning", aliases: ["fönsterputs", "fonsterputs", "fönstertvätt", "fonstertvatt"] },

  { slug: "malning", categorySlug: "maleri", parentServiceSlug: null, label: "Målning", aliases: ["målare", "malare", "måleri", "maleri"] },
  { slug: "snickeri", categorySlug: "snickeri", parentServiceSlug: null, label: "Snickeri", aliases: ["snickare", "byggnadssnickeri"] },
  { slug: "flytthjalp", categorySlug: "flytt", parentServiceSlug: null, label: "Flytthjälp", aliases: ["flyttfirma", "flytthjälp", "flytthjalp"] },
  { slug: "tradgardshjalp", categorySlug: "tradgard", parentServiceSlug: null, label: "Trädgårdshjälp", aliases: ["trädgård", "tradgard", "trädgårdshjälp", "tradgardshjalp"] },
];

function normalizeDirectorySearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchesSearchTerm(term: string, values: string[]) {
  return values.some((value) => normalizeDirectorySearchTerm(value) === term);
}

export function getDirectoryServiceDefinition(slug: string) {
  return DIRECTORY_SERVICES.find((service) => service.slug === slug) ?? null;
}

export function getDirectoryCategoryDefinition(slug: string) {
  return DIRECTORY_SERVICE_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export type DirectoryServiceSearchResolution =
  | { kind: "service"; serviceSlug: string; categorySlug: string }
  | { kind: "category"; categorySlug: string }
  | null;

export function resolveDirectoryServiceQuery(value: string): DirectoryServiceSearchResolution {
  const term = normalizeDirectorySearchTerm(value);
  if (!term) return null;

  const service = DIRECTORY_SERVICES.find((item) => matchesSearchTerm(term, [item.slug, item.label, ...item.aliases]));
  if (service) {
    return {
      kind: "service",
      serviceSlug: service.slug,
      categorySlug: service.categorySlug,
    };
  }

  const category = DIRECTORY_SERVICE_CATEGORIES.find((item) => matchesSearchTerm(term, [item.slug, item.label, ...item.aliases]));
  if (category) {
    return {
      kind: "category",
      categorySlug: category.slug,
    };
  }

  return null;
}
