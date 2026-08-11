import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { getPublicBusinessHub } from "@/lib/public-business-hub";
import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";
import { listPublishedDirectorySitemapEntries } from "@/lib/company-directory-seo";
import { primeViewSite } from "@/lib/primeview-seo";
import { primeViewAreaPages, primeViewServicePages } from "@/lib/primeview-seo-pages";
import { localizedPublicRoutes } from "@/lib/public-locale";
import { resolvePublicCustomDomain } from "@/lib/public-site-domain-routing";
import { hostnameFromHostHeader, isPlatformHost, isPrimeViewHost } from "@/lib/public-site-domains";
import { siteConfig } from "@/lib/site";

const swedishOnlyRoutes = ["/logga-in"] as const;
const primeViewRoutes = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/gallery", changeFrequency: "weekly" as const, priority: 0.8 },
  ...primeViewServicePages.map(({ slug }) => ({ path: `/services/${slug}`, changeFrequency: "monthly" as const, priority: 0.9 })),
  ...primeViewAreaPages.map(({ slug }) => ({ path: `/areas/${slug}`, changeFrequency: "monthly" as const, priority: 0.85 })),
];

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");

  if (isPrimeViewHost(host)) {
    const lastModified = new Date();
    return primeViewRoutes.map((route) => ({
      url: new URL(route.path, primeViewSite.origin).toString(),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }));
  }

  if (!isPlatformHost(host)) {
    const target = await resolvePublicCustomDomain(host);
    if (!target || target.publicHomeMode !== "website") return [];

    const hub = await getPublicBusinessHub(target.workspaceSlug);
    if (!hub) return [];

    const hostname = hostnameFromHostHeader(host);
    const origin = `https://${hostname}`;
    const lastModified = new Date();
    return [
      { url: `${origin}/`, lastModified, changeFrequency: "weekly" as const, priority: 1 },
      ...hub.services.map((service) => ({
        url: `${origin}/tjanster/${encodeURIComponent(service.publicSlug)}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.9,
      })),
    ];
  }

  const [publicBusinessEntries, directoryEntries] = await Promise.all([
    listPublicBusinessSitemapEntries(),
    listPublishedDirectorySitemapEntries(),
  ]);
  const lastModified = new Date();
  const seenBusinesses = new Set<string>();
  const publicBusinessRoutes: MetadataRoute.Sitemap = [];

  for (const entry of publicBusinessEntries) {
    if (!seenBusinesses.has(entry.workspaceSlug)) {
      seenBusinesses.add(entry.workspaceSlug);
      publicBusinessRoutes.push({
        url: `${siteConfig.url}/foretag/${encodeURIComponent(entry.workspaceSlug)}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
    if (entry.serviceSlug) {
      publicBusinessRoutes.push({
        url: `${siteConfig.url}/foretag/${encodeURIComponent(entry.workspaceSlug)}/tjanster/${encodeURIComponent(entry.serviceSlug)}`,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

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
        { url: languages["sv-SE"], lastModified, changeFrequency: route.sv === "/" ? "weekly" as const : "monthly" as const, priority: route.sv === "/" ? 1 : 0.8, alternates: { languages } },
        { url: languages.en, lastModified, changeFrequency: route.en === "/en" ? "weekly" as const : "monthly" as const, priority: route.en === "/en" ? 1 : 0.8, alternates: { languages } },
      ];
    }),
    ...swedishOnlyRoutes.map((route) => ({ url: `${siteConfig.url}${route}`, lastModified, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...publicBusinessRoutes,
    ...directoryRoutes,
  ];
}
