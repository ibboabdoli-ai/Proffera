import type { PublicLocale } from "@/lib/public-locale";
import { quoteRequestPaths } from "./localization";
import { sanitizeQuoteRequestPrefill, type QuoteRequestPrefill } from "./schema";

type DirectoryQuoteInput = {
  categorySlug: string;
  serviceSlug?: string;
  city?: string;
};

const categoryMap: Record<string, string> = {
  stadning: "Städning",
  vvs: "VVS",
  elektriker: "Elektriker",
  maleri: "Måleri",
  snickeri: "Snickeri",
  tradgard: "Trädgård",
  flytt: "Flytthjälp",
  hemservice: "Hemservice",
};

const serviceMap: Record<string, { category: string; serviceType?: string }> = {
  vvs: { category: "VVS", serviceType: "VVS / rörmokare" },
  avloppsrensning: { category: "VVS", serviceType: "Avloppsrensning" },
  vattenlacka: { category: "VVS", serviceType: "Vattenläcka" },
  varmepump: { category: "VVS", serviceType: "Värmepump" },
  elinstallation: { category: "Elektriker", serviceType: "Elinstallation" },
  "felsokning-el": { category: "Elektriker", serviceType: "Felsökning el" },
  laddbox: { category: "Elektriker", serviceType: "Laddbox" },
  elcentral: { category: "Elektriker", serviceType: "Elcentral" },
  lokalvard: { category: "Städning", serviceType: "Städning / lokalvård" },
  hemstadning: { category: "Städning", serviceType: "Hemstädning" },
  kontorsstadning: { category: "Städning", serviceType: "Kontorsstädning" },
  flyttstadning: { category: "Städning", serviceType: "Flyttstädning" },
  fonsterputsning: { category: "Städning", serviceType: "Fönsterputsning" },
  malning: { category: "Måleri", serviceType: "Målning" },
  snickeri: { category: "Snickeri", serviceType: "Snickeri" },
  flytthjalp: { category: "Flytthjälp" },
  tradgardshjalp: { category: "Trädgård" },
  hemservice: { category: "Hemservice", serviceType: "Hemservice" },
};

export function directoryQuotePrefill(input: DirectoryQuoteInput): QuoteRequestPrefill {
  const service = input.serviceSlug ? serviceMap[input.serviceSlug] : undefined;
  const category = service?.category ?? categoryMap[input.categorySlug] ?? "";
  return sanitizeQuoteRequestPrefill({
    category,
    serviceType: service?.serviceType ?? "",
    city: input.city ?? "",
  });
}

export function quoteRequestHref(locale: PublicLocale, input: DirectoryQuoteInput) {
  const prefill = directoryQuotePrefill(input);
  const params = new URLSearchParams();
  if (prefill.category) params.set("category", prefill.category);
  if (prefill.serviceType) params.set("service", prefill.serviceType);
  if (prefill.city) params.set("city", prefill.city);
  const query = params.toString();
  return `${quoteRequestPaths[locale]}${query ? `?${query}` : ""}`;
}
