import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => name.toLowerCase() === "host" ? "www.primeviewwindowcare.co.uk" : null,
  })),
}));
vi.mock("@/lib/public-business-hub", () => ({ getPublicBusinessHub: vi.fn() }));
vi.mock("@/lib/public-business-seo", () => ({
  isIndexablePublicBusinessWorkspace: vi.fn(() => true),
  listPublicBusinessSitemapEntries: vi.fn(async () => []),
}));
vi.mock("@/lib/company-directory-landing-seo", () => ({ listDirectorySeoLandings: vi.fn(async () => []) }));
vi.mock("@/lib/company-directory-seo", () => ({ listPublishedDirectorySitemapEntries: vi.fn(async () => []) }));
vi.mock("@/lib/public-site-domain-routing", () => ({ resolvePublicCustomDomain: vi.fn() }));

import sitemap from "../src/app/sitemap";

describe("PrimeView sitemap area hygiene", () => {
  it("publishes curated area landing pages but omits generated thin area pages", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://www.primeviewwindowcare.co.uk/areas/ealing");
    expect(urls).toContain("https://www.primeviewwindowcare.co.uk/areas/harrow");
    expect(urls).not.toContain("https://www.primeviewwindowcare.co.uk/areas/hammersmith");
    expect(urls).not.toContain("https://www.primeviewwindowcare.co.uk/areas/wimbledon");
    expect(urls).toHaveLength(21);
  });
});
