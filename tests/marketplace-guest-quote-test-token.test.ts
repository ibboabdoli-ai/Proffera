import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import {
  createMarketplaceGuestQuoteTestToken,
  getMarketplaceGuestQuoteTestView,
} from "@/lib/marketplace-guest-quote-test";
import { guestQuoteTestCopy, guestQuoteTestHref } from "@/app/offert/testa/[token]/guest-test-locale";
import MarketplaceGuestQuoteTestPage, { generateMetadata } from "@/app/offert/testa/[token]/page";

const originalCustomerPortalSecret = process.env.CUSTOMER_PORTAL_SECRET;

describe("marketplace guest quote test token", () => {
  beforeEach(() => {
    process.env.CUSTOMER_PORTAL_SECRET = "guest-quote-test-secret";
  });

  afterEach(() => {
    if (originalCustomerPortalSecret === undefined) delete process.env.CUSTOMER_PORTAL_SECRET;
    else process.env.CUSTOMER_PORTAL_SECRET = originalCustomerPortalSecret;
    vi.restoreAllMocks();
  });

  it("accepts a signed, short-lived test token without any customer or company identifiers", () => {
    const token = createMarketplaceGuestQuoteTestToken({ expiresInSeconds: 60 });
    const view = getMarketplaceGuestQuoteTestView(token);

    expect(view?.expiresAt).toBeTruthy();
    expect(Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8")).not.toMatch(/email|company|quote|profile/iu);
  });

  it("rejects tampered and expired test links", () => {
    const token = createMarketplaceGuestQuoteTestToken({ expiresInSeconds: 60 });
    const expired = createMarketplaceGuestQuoteTestToken({ expiresInSeconds: -1 });

    expect(getMarketplaceGuestQuoteTestView(`${token}x`)).toBeNull();
    expect(getMarketplaceGuestQuoteTestView(`${token}.value`)).toBeNull();
    expect(getMarketplaceGuestQuoteTestView(expired)).toBeNull();
  });

  it("keeps the public test confirmation available in Swedish and English", () => {
    expect(guestQuoteTestCopy.sv.title).toBe("Guest Quote-länken fungerar");
    expect(guestQuoteTestCopy.en.title).toBe("The Guest Quote link works");
    expect(guestQuoteTestHref("signed-token", "sv")).toBe("/offert/testa/signed-token");
    expect(guestQuoteTestHref("signed-token", "en")).toBe("/offert/testa/signed-token?lang=en");
  });

  it("renders valid and invalid public test links in both languages with no-index metadata", async () => {
    const token = createMarketplaceGuestQuoteTestToken({ expiresInSeconds: 60 });
    const swedish = renderToStaticMarkup(await MarketplaceGuestQuoteTestPage({
      params: Promise.resolve({ token }),
      searchParams: Promise.resolve({ lang: "sv" }),
    }));
    const english = renderToStaticMarkup(await MarketplaceGuestQuoteTestPage({
      params: Promise.resolve({ token }),
      searchParams: Promise.resolve({ lang: "en" }),
    }));
    const invalidSwedish = renderToStaticMarkup(await MarketplaceGuestQuoteTestPage({
      params: Promise.resolve({ token: "invalid" }),
      searchParams: Promise.resolve({ lang: "sv" }),
    }));
    const invalidEnglish = renderToStaticMarkup(await MarketplaceGuestQuoteTestPage({
      params: Promise.resolve({ token: "invalid" }),
      searchParams: Promise.resolve({ lang: "en" }),
    }));
    const englishMetadata = await generateMetadata({ searchParams: Promise.resolve({ lang: "en" }) });
    const swedishMetadata = await generateMetadata({ searchParams: Promise.resolve({ lang: "sv" }) });

    expect(swedish).toContain("Guest Quote-länken fungerar");
    expect(swedish).toContain(`href="/offert/testa/${encodeURIComponent(token)}?lang=en"`);
    expect(english).toContain("The Guest Quote link works");
    expect(english).toContain(`href="/offert/testa/${encodeURIComponent(token)}"`);
    expect(invalidSwedish).toContain("Testlänken kan inte användas");
    expect(invalidEnglish).toContain("This test link cannot be used");
    expect(englishMetadata).toMatchObject({ title: "Guest Quote test | Proffera", robots: { index: false, follow: false } });
    expect(swedishMetadata).toMatchObject({ title: "Guest Quote-test | Proffera", robots: { index: false, follow: false } });
  });
});
