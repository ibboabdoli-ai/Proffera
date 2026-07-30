import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { primeViewSite } from "@/lib/primeview-seo";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import { localizedPublicRoutes } from "@/lib/public-locale";
import { siteConfig } from "@/lib/site";

const swedishOnlyRoutes = ["/logga-in"] as const;

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

  const lastModified = new Date();

  return [
    ...localizedPublicRoutes.flatMap((route) => {
      const languages = {
        "sv-SE": `${siteConfig.url}${route.sv}`,
        en: `${siteConfig.url}${route.en}`,
      };

      return [
        {
          url: languages["sv-SE"],
          lastModified,
          changeFrequency: route.sv === "/" ? "weekly" as const : "monthly" as const,
          priority: route.sv === "/" ? 1 : 0.8,
          alternates: { languages },
        },
        {
          url: languages.en,
          lastModified,
          changeFrequency: route.en === "/en" ? "weekly" as const : "monthly" as const,
          priority: route.en === "/en" ? 1 : 0.8,
          alternates: { languages },
        },
      ];
    }),
    ...swedishOnlyRoutes.map((route) => ({
      url: `${siteConfig.url}${route}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
