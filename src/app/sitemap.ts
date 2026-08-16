import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { getPublicBusinessHub } from "@/lib/public-business-hub";
import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";
import { listPublishedDirectorySitemapEntries } from "@/lib/company-directory-seo";
import { marketingServiceSlugs } from "@/lib/marketing-service-pages";
import { primeViewAreaPages } from "@/lib/primeview-area-pages";
import { primeViewSite } from "@/lib/primeview-seo";
import { primeViewServicePages } from "@/lib/primeview-seo-pages";
import { localizedPublicRoutes } from "@/lib/public-locale";
import { resolvePublicCustomDomain } from "@/lib/public-site-domain-routing";
import { hostnameFromHostHeader, isPlatformHost, isPrimeViewHost } from "@/lib/public-site-domains";
import { siteConfig } from "@/lib/site";

const swedishOnlyRoutes = [
  "/logga-in",
  ...marketingServiceSlugs.map((slug) => `/tjanster/${slug}`),
];
const primeViewRoutes = [
  "/",
  "/services",
  "/areas",
  "/gallery",
  "/privacy",
  ...primeViewServicePages.map(({ slug }) => `/services/${slug}`),
  ...primeViewAreaPages.map(({ slug }) => `/areas/${slug}`),
] as const;

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");

  if (isPrimeViewHost(host)) {
    return primeViewRoutes.map((path) => ({
      url: new URL(path, primeViewSite.origin).toString(),
    }));
  }

  if (!isPlatformHost(host)) {
    const target = await resolvePublicCustomDomain(host);
    if (!target || target.publicHomeMode !== "website") return [];

    const hub = await getPublicBusinessHub(target.workspaceSlug);
    if (!hub) return [];

    const hostname = hostnameFromHostHeader(host);
    const origin = `https://${hostname}`;
    return [
      { url: `${origin}/`, changeFrequency: "weekly" as const, priority: 1 },
      ...hub.services.map((service) => ({
        url: `${origin}/tjanster/${encodeURIComponent(service.publicSlug)}`,
        changeFrequency: "monthly" as const,
        priority: 0.9,
      })),
    ];
  }

  const [publicBusinessEntries, directoryEntries] = await Promise.all([
    listPublicBusinessSitemapEntries(),
    listPublishedDirectorySitemapEntries(),
  ]);
  const seenBusinesses = new Set<string>();
  const publicBusinessRoutes: MetadataRoute.Sitemap = [];

  for (const entry of publicBusinessEntries) {
    if (!seenBusinesses.has(entry.workspaceSlug)) {
      seenBusinesses.add(entry.workspaceSlug);
      publicBusinessRoutes.push({
        url: `${siteConfig.url}/foretag/${encodeURIComponent(entry.workspaceSlug)}`,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
    if (entry.serviceSlug) {
      publicBusinessRoutes.push({
        url: `${siteConfig.url}/foretag/${encodeURIComponent(entry.workspaceSlug)}/tjanster/${encodeURIComponent(entry.serviceSlug)}`,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  // Only publish lastModified when the source provides a trustworthy content timestamp.
  const directoryRoutes: MetadataRoute.Sitemap = directoryEntries.map((entry) => ({
    url: `${siteConfig.url}/foretag/listad/${encodeURIComponent(entry.slug)}`,
    lastModified: entry.lastModified,
    changeFrequency: "weekly",
    priority: 0.65,
  }));

  return [
    ...localizedPublicRoutes.flatMap((route) => {
      const languages = { "sv-SE": `${siteConfig.url}${route.sv}`, en: `${siteConfig.url}${route.en}` };
      return [
        { url: languages["sv-SE"], changeFrequency: route.sv === "/" ? "weekly" as const : "monthly" as const, priority: route.sv === "/" ? 1 : 0.8, alternates: { languages } },
        { url: languages.en, changeFrequency: route.en === "/en" ? "weekly" as const : "monthly" as const, priority: route.en === "/en" ? 1 : 0.8, alternates: { languages } },
      ];
    }),
    ...swedishOnlyRoutes.map((route) => ({ url: `${siteConfig.url}${route}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...publicBusinessRoutes,
    ...directoryRoutes,
  ];
}
