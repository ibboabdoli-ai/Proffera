import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public customer lifecycle human UX", () => {
  it("uses the approved marketplace palette and restrained shared surface", () => {
    const css = source("src/app/public-customer-lifecycle.module.css");

    expect(css).toContain("#0a2e63");
    expect(css).toContain("#1469d8");
    expect(css).toContain("#dce4ee");
    expect(css).toContain("#f6f9fd");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("radial-gradient");
  });

  it("keeps workspace offer response private, bilingual, and behavior-preserving", () => {
    const page = source("src/app/offert/[token]/page.tsx");
    const action = source("src/app/offert/[token]/actions.ts");

    expect(page).toContain("public-customer-lifecycle.module.css");
    expect(page).toContain("getPublicWorkspaceQuoteOffer(token)");
    expect(page).toContain('offer.status === "sent"');
    expect(page).toContain('offer.status === "accepted"');
    expect(page).toContain('name="decision" value="accepted"');
    expect(page).toContain('name="decision" value="rejected"');
    expect(page).toContain('name="lang" value={locale}');
    expect(page).toContain("Säker personlig länk");
    expect(page).toContain("Secure personal link");
    expect(page).toContain("publicWorkspaceQuoteOfferPdfPath(token)");
    expect(page).toContain('if (response) query.set("response", response)');
    expect(page).toContain("publicHref(token, alternativeLocale, response)");

    expect(action).toContain('decision !== "accepted" && decision !== "rejected"');
    expect(action).toContain("respondToPublicWorkspaceQuoteOffer(token");
    expect(action).toContain('result.ok ? result.response : "invalid"');
  });

  it("keeps Marketplace offer selection token-isolated with honest empty and review states", () => {
    const page = source("src/app/offert/jamfor/[token]/page.tsx");
    const action = source("src/app/offert/jamfor/[token]/actions.ts");

    expect(page).toContain("getMarketplaceCustomerComparison(token)");
    expect(page).toContain("view.offers.length > 0");
    expect(page).toContain("No offers to show yet");
    expect(page).toContain("Inga offerter att visa ännu");
    expect(page).toContain("offer.rating === null");
    expect(page).toContain("offer.providerEmail");
    expect(page).toContain('offer.status === "submitted"');
    expect(page).toContain('name="offerId" value={offer.id}');
    expect(page).toContain('name="lang" value={locale}');

    expect(action).toContain("hashMarketplaceCustomerComparisonToken(token)");
    expect(action).toContain("selectMarketplaceCustomerOffer(token, offerId)");
    expect(action).toContain("redirectToSelectedJob(token, locale)");
  });

  it("keeps the customer job self-service actions and rematch semantics unchanged", () => {
    const page = source("src/app/offert/jobb/kund/[token]/page.tsx");

    expect(page).toContain("getMarketplaceServiceJobForCustomerToken(token)");
    expect(page).toContain("getMarketplaceCustomerComparison(token)");
    expect(page).toContain("getMarketplaceRematchForCustomerToken(token)");
    expect(page).toContain('name="intent" value="cancel"');
    expect(page).toContain('name="intent" value="rematch"');
    expect(page).toContain('method="post"');
    expect(page).toContain('name="lang" value={locale}');
    expect(page).toContain("Säker personlig jobblänk");
    expect(page).toContain("Secure personal job link");
  });

  it("supports Swedish and English across both secure review-token experiences", () => {
    const bookingReview = source("src/app/review/[token]/page.tsx");
    const marketplaceReview = source("src/app/review/marketplace/[token]/page.tsx");

    for (const page of [bookingReview, marketplaceReview]) {
      expect(page).toContain("searchParams");
      expect(page).toContain('value === "en" || value === "sv"');
      expect(page).toContain("Verified");
      expect(page).toContain("Verifierat");
      expect(page).toContain("robots: { index: false, follow: false }");
      expect(page).toContain("VerifiedReviewForm");
      expect(page).toContain("public-customer-lifecycle.module.css");
    }

    expect(bookingReview).toContain("getVerifiedReviewInvitation(token)");
    expect(marketplaceReview).toContain("hashVerifiedReviewToken(parsed.data)");
    expect(marketplaceReview).toContain("getMarketplaceVerifiedReviewPreviewByHash");
  });

  it("keeps review submission anti-abuse, consent, API, and success/error states intact", () => {
    const form = source("src/app/review/[token]/verified-review-form.tsx");

    expect(form).toContain('name="website"');
    expect(form).toContain('aria-hidden="true"');
    expect(form).toContain('name="consent"');
    expect(form).toContain('required');
    expect(form).toContain('fetch("/api/reviews/" + encodeURIComponent(token)');
    expect(form).toContain("formStartedAtRef");
    expect(form).toContain("marketplace_verified_review_submitted");
    expect(form).toContain("messageError");
    expect(form).toContain("messageSuccess");
  });
});
