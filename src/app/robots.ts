import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { primeViewSite } from "@/lib/primeview-seo";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();

  if (isPrimeViewHost(requestHeaders.get("host"))) {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/app/", "/dashboard/", "/demo/"],
      },
      sitemap: `${primeViewSite.origin}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/dashboard/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
