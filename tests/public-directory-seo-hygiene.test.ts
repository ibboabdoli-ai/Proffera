import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  listPublicBusinessSitemapEntries: vi.fn(),
  listPublishedDirectorySitemapEntries: vi.fn(),
  resolvePublicCustomDomain: vi.fn(),
  getPublicBusinessHub: vi.fn(),
  getPublicDirectoryBusinessForRequest: vi.fn(),
  getSeoBusinessProjection: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/public-business-seo", () => ({
  listPublicBusinessSitemapEntries: mocks.listPublicBusinessSitemapEntries,
}));
vi.mock("@/lib/company-directory-seo", () => ({
  listPublishedDirectorySitemapEntries: mocks.listPublishedDirectorySitemapEntries,
}));
vi.mock("@/lib/public-site-domain-routing", () => ({
  resolvePublicCustomDomain: mocks.resolvePublicCustomDomain,
}));
vi.mock("@/lib/public-business-hub", () => ({
  getPublicBusinessHub: mocks.getPublicBusinessHub,
}));
vi.mock("@/lib/company-directory-public-data", () => ({
  getPublicDirectoryBusinessForRequest: mocks.getPublicDirectoryBusinessForRequest,
}));
vi.mock("@/lib/business-profile-public", () => ({
  getSeoBusinessProjection: mocks.getSeoBusinessProjection,
}));
vi.mock("@/components/company-directory/public-directory-profile", () => ({
  PublicDirectoryProfile: () => null,
}));
vi.mock("@/components/company-directory/public-directory-search-page", () => ({
  PublicDirectorySearchPage: () => null,
}));

import { metadata as englishListingMetadata } from "@/app/en/companies/page";
import { generateMetadata as generateEnglishMetadata } from "@/app/en/companies/[slug]/page";
import { metadata as swedishListingMetadata } from "@/app/foretag/listad/page";
import { generateMetadata as generateSwedishMetadata } from "@/app/foretag/listad/[slug]/page";
import sitemap from "@/app/sitemap";
import { siteConfig } from "@/lib/site";

const profile = {
  slug: "exempel-el-ab",
  companyName: "Exempel El AB",
  city: "Södertälje",
  categorySlug: "elektriker",
  primarySniLabel: "Elinstallationer",
  activityDescription: "Elinstallationer för företag och hushåll.",
  media: null,
};

describe("public directory SEO hygiene", () => {
  beforeEach(() => {
    mocks.headers.mockResolvedValue(new Headers({ host: "www.proffera.se" }));
    mocks.listPublicBusinessSitemapEntries.mockResolvedValue([]);
    mocks.listPublishedDirectorySitemapEntries.mockResolvedValue([{
      slug: profile.slug,
      lastModified: new Date("2026-08-20T00:00:00Z"),
    }]);
    mocks.resolvePublicCustomDomain.mockResolvedValue(null);
    mocks.getPublicBusinessHub.mockResolvedValue(null);
    mocks.getPublicDirectoryBusinessForRequest.mockResolvedValue(profile);
    mocks.getSeoBusinessProjection.mockResolvedValue({
      directorySlug: profile.slug,
      displayName: profile.companyName,
      description: profile.activityDescription,
      categorySlug: profile.categorySlug,
      city: profile.city,
      mediaUrl: "",
    });
  });

  it("uses the redirect target as the single platform origin", () => {
    expect(siteConfig.url).toBe("https://www.proffera.se");
  });

  it("omits noindex search routes and emits reciprocal profile locales", async () => {
    const routes = await sitemap();
    const svUrl = `${siteConfig.url}/foretag/listad/${profile.slug}`;
    const enUrl = `${siteConfig.url}/en/companies/${profile.slug}`;
    const languages = { "sv-SE": svUrl, en: enUrl };

    expect(routes.some((route) => route.url === `${siteConfig.url}/foretag/listad`)).toBe(false);
    expect(routes.some((route) => route.url === `${siteConfig.url}/en/companies`)).toBe(false);
    expect(swedishListingMetadata.robots).toEqual({ index: false, follow: true });
    expect(englishListingMetadata.robots).toEqual({ index: false, follow: true });
    expect(routes.find((route) => route.url === svUrl)).toEqual(expect.objectContaining({
      lastModified: new Date("2026-08-20T00:00:00Z"),
      alternates: { languages },
    }));
    expect(routes.find((route) => route.url === enUrl)).toEqual(expect.objectContaining({
      lastModified: new Date("2026-08-20T00:00:00Z"),
      alternates: { languages },
    }));
  });

  it("produces canonical bilingual profile metadata without duplicating the brand", async () => {
    const params = Promise.resolve({ slug: profile.slug });
    const [sv, en] = await Promise.all([
      generateSwedishMetadata({ params }),
      generateEnglishMetadata({ params }),
    ]);

    expect(sv).toEqual(expect.objectContaining({
      title: profile.companyName,
      alternates: {
        canonical: `${siteConfig.url}/foretag/listad/${profile.slug}`,
        languages: {
          "sv-SE": `/foretag/listad/${profile.slug}`,
          en: `/en/companies/${profile.slug}`,
        },
      },
      openGraph: expect.objectContaining({
        title: profile.companyName,
        url: `${siteConfig.url}/foretag/listad/${profile.slug}`,
      }),
      twitter: expect.objectContaining({ card: "summary", title: profile.companyName }),
    }));
    expect(en).toEqual(expect.objectContaining({
      title: profile.companyName,
      alternates: {
        canonical: `${siteConfig.url}/en/companies/${profile.slug}`,
        languages: {
          "sv-SE": `/foretag/listad/${profile.slug}`,
          en: `/en/companies/${profile.slug}`,
        },
      },
      openGraph: expect.objectContaining({
        title: profile.companyName,
        url: `${siteConfig.url}/en/companies/${profile.slug}`,
      }),
      twitter: expect.objectContaining({ card: "summary", title: profile.companyName }),
    }));
    expect(String(sv.title)).not.toContain("| Proffera");
    expect(String(en.title)).not.toContain("| Proffera");
  });
});
