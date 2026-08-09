import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { primeViewSite } from "@/lib/primeview-seo";
import { resolvePublicCustomDomain } from "@/lib/public-site-domain-routing";
import { hostnameFromHostHeader, isPlatformHost, isPrimeViewHost } from "@/lib/public-site-domains";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");

  if (isPrimeViewHost(host)) {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/app/", "/dashboard/", "/demo/"],
      },
      sitemap: `${primeViewSite.origin}/sitemap.xml`,
    };
  }

  if (!isPlatformHost(host)) {
    const hostname = hostnameFromHostHeader(host);
    const target = await resolvePublicCustomDomain(host);
    if (!target || !hostname) {
      return { rules: { userAgent: "*", disallow: "/" } };
    }

    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/app/", "/dashboard/", "/demo/", "/foretag/"],
      },
      sitemap: target.publicHomeMode === "website" ? `https://${hostname}/sitemap.xml` : undefined,
      host: `https://${hostname}`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/app/", "/dashboard/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
