import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { primeViewSite } from "@/lib/primeview-seo";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import { siteConfig } from "@/lib/site";

const routes = [
  "",
  "/tjanster",
  "/branscher",
  "/priser",
  "/demo",
  "/om",
  "/kontakt",
  "/logga-in",
  "/integritetspolicy",
  "/villkor",
  "/cookies",
] as const;

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();

  if (isPrimeViewHost(requestHeaders.get("host"))) {
    return [
      {
        url: primeViewSite.canonicalUrl,
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
