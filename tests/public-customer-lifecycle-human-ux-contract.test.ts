import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicWorkspaceQuoteOffer: vi.fn(),
  getMarketplaceCustomerComparison: vi.fn(),
  getMarketplaceRematchForCustomerToken: vi.fn(),
  getMarketplaceServiceJobForCustomerToken: vi.fn(),
  getVerifiedReviewInvitation: vi.fn(),
  getMarketplaceVerifiedReviewPreviewByHash: vi.fn(),
  hashVerifiedReviewToken: vi.fn(() => "a".repeat(64)),
  safeParseReviewToken: vi.fn((token: string) => ({ success: true as const, data: token })),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T,>(fn: T) => fn };
});
vi.mock("server-only", () => ({}));
vi.mock("@/app/offert/[token]/actions", () => ({ respondToPublicQuoteOfferAction: vi.fn() }));
vi.mock("@/app/offert/jamfor/[token]/actions", () => ({ selectMarketplaceCustomerOfferAction: vi.fn() }));
vi.mock("@/components/analytics/marketplace-funnel-signal", () => ({ emitMarketplaceFunnelEvent: vi.fn() }));
vi.mock("@/lib/workspace-quote-offers-db", () => ({ getPublicWorkspaceQuoteOffer: mocks.getPublicWorkspaceQuoteOffer }));
vi.mock("@/lib/workspace-quote-offer-public", () => ({
  publicWorkspaceQuoteOfferPath: (token: string) => "/offert/" + encodeURIComponent(token),
  publicWorkspaceQuoteOfferPdfPath: (token: string) => "/offert/" + encodeURIComponent(token) + "/pdf",
}));
vi.mock("@/lib/marketplace-customer-comparison", () => ({
  getMarketplaceCustomerComparison: mocks.getMarketplaceCustomerComparison,
  marketplaceCustomerComparisonPath: (token: string) => "/offert/jamfor/" + encodeURIComponent(token),
}));
vi.mock("@/lib/marketplace-rematch", () => ({
  getMarketplaceRematchForCustomerToken: mocks.getMarketplaceRematchForCustomerToken,
}));
vi.mock("@/lib/marketplace-service-jobs", () => ({
  getMarketplaceServiceJobForCustomerToken: mocks.getMarketplaceServiceJobForCustomerToken,
}));
vi.mock("@/lib/verified-review-invitations", () => ({
  getVerifiedReviewInvitation: mocks.getVerifiedReviewInvitation,
}));
vi.mock("@/features/reviews/verified-review", () => ({
  verifiedReviewTokenSchema: { safeParse: mocks.safeParseReviewToken },
}));
vi.mock("@/lib/marketplace-verified-review", () => ({
  getMarketplaceVerifiedReviewPreviewByHash: mocks.getMarketplaceVerifiedReviewPreviewByHash,
}));
vi.mock("@/lib/verified-review-token", () => ({
  hashVerifiedReviewToken: mocks.hashVerifiedReviewToken,
}));

import PublicQuoteOfferPage, {
  generateMetadata as generatePublicQuoteMetadata,
} from "@/app/offert/[token]/page";
import MarketplaceCustomerComparisonPage from "@/app/offert/jamfor/[token]/page";
import MarketplaceCustomerJobPage from "@/app/offert/jobb/kund/[token]/page";
import lifecycleStyles from "@/app/public-customer-lifecycle.module.css";
import VerifiedReviewPage, {
  generateMetadata as generateVerifiedReviewMetadata,
} from "@/app/review/[token]/page";
import MarketplaceVerifiedReviewPage, {
  generateMetadata as generateMarketplaceReviewMetadata,
} from "@/app/review/marketplace/[token]/page";

const selectedComparison = {
  quoteReferenceId: "PF-1234",
  serviceType: "plumbing",
  city: "Stockholm",
  preferredDate: "2030-02-03",
  quoteStatus: "booked",
  selectedOfferId: "offer-1",
  offers: [
    {
      id: "offer-1",
      companyName: "Nordic Fix AB",
      profileSlug: "nordic-fix-ab",
      status: "selected",
      priceKind: "fixed",
      currency: "SEK",
      amountMinor: 125000,
      availableDate: "2030-02-03",
      companyNote: "We can help.",
      directContactRedacted: false,
      submittedAt: "2030-01-01T10:00:00.000Z",
      rating: 4.8,
      reviewCount: 12,
      providerEmail: "winner@nordic-fix.test",
    },
    {
      id: "offer-2",
      companyName: "Other Provider AB",
      profileSlug: "other-provider-ab",
      status: "rejected",
      priceKind: "estimate",
      currency: "SEK",
      amountMinor: 140000,
      availableDate: "2030-02-05",
      companyNote: "Call […] for details.",
      directContactRedacted: true,
      submittedAt: "2030-01-01T11:00:00.000Z",
      rating: null,
      reviewCount: 0,
      providerEmail: "loser@other-provider.test",
    },
  ],
};

const englishReviewInvitation = {
  state: "valid",
  customerName: "Anna",
  service: "Window cleaning",
  area: "Stockholm",
  bookingId: "booking-1",
  expiresAt: "2030-02-20T12:00:00.000Z",
  companyName: "Nordic Fix AB",
  timeZone: "Europe/Stockholm",
  language: "en",
  primaryColor: "#1469d8",
  accentColor: "#d8ae52",
  logoUrl: null,
  homeUrl: "/foretag/nordic-fix",
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockClear();
  mocks.getMarketplaceRematchForCustomerToken.mockResolvedValue(null);
});

describe("public customer lifecycle rendered contract", () => {
  it("renders direct quote state in Swedish and preserves response feedback when switching to English", async () => {
    mocks.getPublicWorkspaceQuoteOffer.mockResolvedValue({
      companyName: "Nordic Fix AB",
      customerName: "Anna",
      status: "accepted",
      quoteReferenceId: "PF-1234",
      validUntil: "2030-02-10T12:00:00.000Z",
      sentAt: "2030-02-01T12:00:00.000Z",
      title: "Badrumsrenovering",
      terms: "Arbete enligt offert.",
      subtotalMinor: 100000,
      vatRateBasisPoints: 2500,
      vatAmountMinor: 25000,
      totalMinor: 125000,
      currency: "SEK",
    });

    const metadata = await generatePublicQuoteMetadata({
      searchParams: Promise.resolve({ lang: "en" }),
    });
    const html = renderToStaticMarkup(await PublicQuoteOfferPage({
      params: Promise.resolve({ token: "quote-token" }),
      searchParams: Promise.resolve({ response: "invalid" }),
    }));

    expect(metadata.title).toBe("Quote");
    expect(html).toContain('<main lang="sv"');
    expect(html).toContain(`class="${lifecycleStyles.page}"`);
    expect(html).toContain("Offerten är accepterad");
    expect(html).toContain("Ditt svar kunde inte registreras");
    expect(html).toContain('href="/offert/quote-token?lang=en&amp;response=invalid"');
  });

  it("renders a selected Marketplace offer without leaking losing-provider contact data", async () => {
    mocks.getMarketplaceCustomerComparison.mockResolvedValue(selectedComparison);

    const html = renderToStaticMarkup(await MarketplaceCustomerComparisonPage({
      params: Promise.resolve({ token: "customer-token" }),
      searchParams: Promise.resolve({ lang: "en", status: "selected" }),
    }));

    expect(html).toContain('<main lang="en"');
    expect(html).toContain("Your selection has been recorded.");
    expect(html).toContain("Nordic Fix AB");
    expect(html).toContain("plumbing · Stockholm");
    expect(html).toContain('href="mailto:winner@nordic-fix.test"');
    expect(html).not.toContain("loser@other-provider.test");
    expect(html).toContain("Call […] for details.");
    expect(html).toContain('href="/offert/jamfor/customer-token?status=selected"');
  });

  it("renders the completed customer job with the selected provider and locale-safe feedback", async () => {
    mocks.getMarketplaceCustomerComparison.mockResolvedValue(selectedComparison);
    mocks.getMarketplaceServiceJobForCustomerToken.mockResolvedValue({
      status: "completed",
      serviceName: "Plumbing",
      scheduledDate: "2030-02-03",
      amountMinor: 125000,
      currency: "SEK",
    });

    const html = renderToStaticMarkup(await MarketplaceCustomerJobPage({
      params: Promise.resolve({ token: "customer-token" }),
      searchParams: Promise.resolve({ lang: "en", status: "selected" }),
    }));

    expect(html).toContain('<main lang="en"');
    expect(html).toContain("Your selection is recorded and the job has been created.");
    expect(html).toContain("Nordic Fix AB");
    expect(html).toContain('href="mailto:winner@nordic-fix.test"');
    expect(html).toContain("The job is marked completed.");
    expect(html).toContain('href="/offert/jobb/kund/customer-token?status=selected"');
    expect(html).not.toContain("Cancel job");
  });

  it("uses the booking review invitation language for metadata and rendered UI when the URL has no locale override", async () => {
    mocks.getVerifiedReviewInvitation.mockResolvedValue(englishReviewInvitation);

    const metadata = await generateVerifiedReviewMetadata({
      params: Promise.resolve({ token: "review-token" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(await VerifiedReviewPage({
      params: Promise.resolve({ token: "review-token" }),
      searchParams: Promise.resolve({}),
    }));

    expect(metadata.title).toEqual({ absolute: "Verified customer review" });
    expect(html).toContain('<main class="' + lifecycleStyles.page + '" lang="en"');
    expect(html).toContain("Verified customer review");
    expect(html).toContain("Submit verified review");
    expect(html).toContain('href="/review/review-token?lang=sv"');
  });

  it("uses the Marketplace invitation language for metadata and rendered UI when the URL has no locale override", async () => {
    mocks.getMarketplaceVerifiedReviewPreviewByHash.mockResolvedValue(englishReviewInvitation);

    const metadata = await generateMarketplaceReviewMetadata({
      params: Promise.resolve({ token: "marketplace-review-token" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(await MarketplaceVerifiedReviewPage({
      params: Promise.resolve({ token: "marketplace-review-token" }),
      searchParams: Promise.resolve({}),
    }));

    expect(metadata.title).toEqual({ absolute: "Verified Marketplace review" });
    expect(html).toContain('<main lang="en" class="' + lifecycleStyles.page + '"');
    expect(html).toContain("Verified Marketplace review");
    expect(html).toContain("Submit verified review");
    expect(html).toContain('href="/review/marketplace/marketplace-review-token?lang=sv"');
  });
});
