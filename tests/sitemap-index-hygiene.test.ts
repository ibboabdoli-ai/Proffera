import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  listPublicBusinessSitemapEntries: vi.fn(),
  listPublishedDirectorySitemapEntries: vi.fn(),
  listDirectorySeoLandings: vi.fn(),
  getPublicBusinessHub: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/components/company-directory/public-directory-search-page", () => ({
  PublicDirectorySearchPage: () => null,
}));
vi.mock("@/lib/public-business-seo", () => ({
  listPublicBusinessSitemapEntries: mocks.listPublicBusinessSitemapEntries,
}));
vi.mock("@/lib/company-directory-seo", () => ({
  listPublishedDirectorySitemapEntries: mocks.listPublishedDirectorySitemapEntries,
}));
vi.mock("@/lib/company-directory-landing-seo", () => ({
  listDirectorySeoLandings: mocks.listDirectorySeoLandings,
}));
vi.mock("@/lib/public-business-hub", () => ({ getPublicBusinessHub: mocks.getPublicBusinessHub }));
vi.mock("@/lib/public-site-domain-routing", () => ({ resolvePublicCustomDomain: vi.fn(async () => null) }));
vi.mock("@/lib/public-site-domains", () => ({
  hostnameFromHostHeader: (host: string | null | undefined) => host?.split(":")[0] ?? "",
  isPlatformHost: () => true,
  isPrimeViewHost: () => false,
}));

import sitemap from "@/app/sitemap";
import { metadata as swedishSearchMetadata } from "@/app/foretag/listad/page";
import { metadata as englishSearchMetadata } from "@/app/en/companies/page";
import { metadata as swedishRegisterMetadata } from "@/app/anslut-foretag/registrera/layout";
import { metadata as swedishThankYouMetadata } from "@/app/anslut-foretag/tack/layout";
import { metadata as englishRegisterMetadata } from "@/app/en/join-business/register/layout";
import { metadata as englishThankYouMetadata } from "@/app/en/join-business/thank-you/layout";

describe("sitemap index hygiene", () => {
  beforeEach(() => {
    mocks.headers.mockReset();
    mocks.listPublicBusinessSitemapEntries.mockReset();
    mocks.listPublishedDirectorySitemapEntries.mockReset();
    mocks.listDirectorySeoLandings.mockReset();
    mocks.getPublicBusinessHub.mockReset();

    mocks.headers.mockResolvedValue({ get: () => "www.proffera.se" });
    mocks.listPublicBusinessSitemapEntries.mockResolvedValue([
      { workspaceId: "1", workspaceSlug: "real-business", serviceSlug: "service-one" },
    ]);
    mocks.listPublishedDirectorySitemapEntries.mockResolvedValue([
      { slug: "published-directory-company", lastModified: new Date("2026-08-25T00:00:00Z") },
    ]);
    mocks.listDirectorySeoLandings.mockResolvedValue([
      { serviceSlug: "vvs", serviceLabel: "VVS / Rörmokare", location: "Södertälje", locationSlug: "sodertalje", businessCount: 3 },
    ]);
  });

  it("omits noindex utility routes and keeps indexable public discovery URLs", async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    expect([...urls].some((url) => url.endsWith("/foretag/listad"))).toBe(false);
    expect([...urls].some((url) => url.endsWith("/en/companies"))).toBe(false);
    expect([...urls].some((url) => url.endsWith("/logga-in"))).toBe(false);
    expect([...urls].some((url) => url.endsWith("/anslut-foretag/registrera"))).toBe(false);
    expect([...urls].some((url) => url.endsWith("/anslut-foretag/tack"))).toBe(false);
    expect([...urls].some((url) => url.endsWith("/en/join-business/register"))).toBe(false);
    expect([...urls].some((url) => url.endsWith("/en/join-business/thank-you"))).toBe(false);

    expect([...urls].some((url) => url.endsWith("/foretag/listad/published-directory-company"))).toBe(true);
    expect([...urls].some((url) => url.endsWith("/en/companies/published-directory-company"))).toBe(true);
    expect([...urls].some((url) => url.endsWith("/hitta/vvs/sodertalje"))).toBe(true);
    expect([...urls].some((url) => url.endsWith("/foretag/real-business"))).toBe(true);
  });

  it("declares Directory search pages as noindex,follow", () => {
    expect(swedishSearchMetadata.robots).toMatchObject({ index: false, follow: true });
    expect(englishSearchMetadata.robots).toMatchObject({ index: false, follow: true });
  });

  it("declares registration and confirmation routes as noindex,follow in both languages", () => {
    for (const metadata of [
      swedishRegisterMetadata,
      swedishThankYouMetadata,
      englishRegisterMetadata,
      englishThankYouMetadata,
    ]) {
      expect(metadata.robots).toMatchObject({ index: false, follow: true });
    }
  });
});
