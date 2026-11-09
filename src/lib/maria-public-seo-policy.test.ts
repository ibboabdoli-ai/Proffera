import { describe, expect, it } from "vitest";

import { getMariaPublicSeoPolicy } from "./maria-public-seo-policy";

describe("Maria branded portfolio SEO policy", () => {
  it.each([
    ["preview", "true"],
    ["development", "true"],
    ["production", "false"],
    ["production", undefined],
  ])("keeps robots and sitemap closed in %s with site flag %s", (environment, siteFlag) => {
    const seo = getMariaPublicSeoPolicy({
      VERCEL_ENV: environment,
      PROFFERA_MARIA_PUBLIC_SITE_ENABLED: siteFlag,
    });
    expect(seo.robots).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(seo.sitemap).toEqual([]);
  });

  it("permits the one-page branded portfolio without enabling live booking", () => {
    const seo = getMariaPublicSeoPolicy({
      VERCEL_ENV: "production",
      PROFFERA_MARIA_PUBLIC_SITE_ENABLED: "true",
      PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "false",
    });
    expect(seo.sitemap).toEqual([
      { url: "https://makeupbymaria.se/", changeFrequency: "weekly", priority: 1 },
    ]);
    expect(seo.robots).toMatchObject({
      host: "https://makeupbymaria.se",
      sitemap: "https://makeupbymaria.se/sitemap.xml",
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: expect.arrayContaining(["/api/", "/dashboard/", "/demo/", "/boka/", "/mina-bokningar/"]),
      },
    });
    expect(seo.robots.rules).not.toEqual({ userAgent: "*", disallow: "/" });
  });
});
