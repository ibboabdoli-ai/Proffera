import type { MetadataRoute } from "next";

import { MARIA_CANONICAL_PRODUCTION_ORIGIN } from "./maria-production-activation-policy";

/**
 * A branded public portfolio may be indexed independently of live booking.
 * The default remains closed; preview and disabled Production stay disallowed.
 * This policy never checks or changes a tenant, feature entitlement or database.
 */
export function getMariaPublicSeoPolicy(env: NodeJS.ProcessEnv = process.env): {
  robots: MetadataRoute.Robots;
  sitemap: MetadataRoute.Sitemap;
} {
  if (env.VERCEL_ENV !== "production" || env.PROFFERA_MARIA_PUBLIC_SITE_ENABLED !== "true") {
    return { robots: { rules: { userAgent: "*", disallow: "/" } }, sitemap: [] };
  }

  return {
    robots: {
      rules: {
        userAgent: "*",
        allow: "/",
        // Do not direct crawlers to private booking, API or internal/demo paths.
        disallow: [
          "/admin/", "/api/", "/app/", "/dashboard/", "/demo/",
          "/boka/", "/mina-bokningar/", "/maria/",
        ],
      },
      sitemap: `${MARIA_CANONICAL_PRODUCTION_ORIGIN}/sitemap.xml`,
      host: MARIA_CANONICAL_PRODUCTION_ORIGIN,
    },
    sitemap: [
      { url: `${MARIA_CANONICAL_PRODUCTION_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    ],
  };
}
