import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createMarketplaceGuestQuoteTestToken,
  getMarketplaceGuestQuoteTestView,
} from "@/lib/marketplace-guest-quote-test";

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
    expect(getMarketplaceGuestQuoteTestView(expired)).toBeNull();
  });
});
