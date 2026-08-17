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
  { slug: "frisor", label: "Frisör", aliases: ["frisör", "frisor", "barberare", "barber", "hårvård", "harvard"] },
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

  { slug: "lokalvard", categorySlug: "stadning", parentServiceSlug: null, label: "Städning / Lokalvård", aliases: ["städning", "stadning", "städ", "stad", "lokalvård", "lokalvard", "städfirma", "stadfirma"] },
  { slug: "hemstadning", categorySlug: "stadning", parentServiceSlug: "lokalvard", label: "Hemstädning", aliases: ["hemstäd", "hemstad", "städning hemma", "stadning hemma"] },
  { slug: "kontorsstadning", categorySlug: "stadning", parentServiceSlug: "lokalvard", label: "Kontorsstädning", aliases: ["kontorsstäd", "kontorsstad"] },
  { slug: "flyttstadning", categorySlug: "stadning", parentServiceSlug: "lokalvard", label: "Flyttstädning", aliases: ["flyttstäd", "flyttstad"] },
  { slug: "fonsterputsning", categorySlug: "stadning", parentServiceSlug: "lokalvard", label: "Fönsterputsning", aliases: ["fönsterputs", "fonsterputs", "fönstertvätt", "fonstertvatt"] },

  { slug: "malning", categorySlug: "maleri", parentServiceSlug: null, label: "Målning", aliases: ["målare", "malare", "måleri", "maleri"] },
  { slug: "snickeri", categorySlug: "snickeri", parentServiceSlug: null, label: "Snickeri", aliases: ["snickare", "byggnadssnickeri"] },
  { slug: "flytthjalp", categorySlug: "flytt", parentServiceSlug: null, label: "Flytthjälp", aliases: ["flyttfirma", "flytthjälp", "flytthjalp"] },
  { slug: "tradgardshjalp", categorySlug: "tradgard", parentServiceSlug: null, label: "Trädgårdshjälp", aliases: ["trädgård", "tradgard", "trädgårdshjälp", "tradgardshjalp"] },
  { slug: "hemservice", categorySlug: "hemservice", parentServiceSlug: null, label: "Hemservice", aliases: ["hemservice", "hushållsnära tjänster", "hushallsnara tjanster"] },
  { slug: "frisor", categorySlug: "frisor", parentServiceSlug: null, label: "Frisör / Barberare", aliases: ["frisör", "frisor", "barberare", "barber", "hårvård", "harvard", "frisörsalong", "frisorsalong"] },
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

function normalizeSni(value: string) {
  const raw = value.trim().replace(",", ".");
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 5 || digits.length === 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  return raw;
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

export function mapPrimarySniToDirectorySearchService(value: string) {
  const code = normalizeSni(value);
  if (code === "81.210") return "lokalvard";
  if (code === "81.221") return "fonsterputsning";
  if (code === "96.910") return "hemservice";
  if (code === "96.210") return "frisor";
  if (code === "49.420") return "flytthjalp";
  if (code === "43.210") return "elinstallation";
  if (code.startsWith("43.22")) return "vvs";
  if (code === "43.341") return "malning";
  if (code === "43.320") return "snickeri";
  if (code === "81.300") return "tradgardshjalp";
  return null;
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
