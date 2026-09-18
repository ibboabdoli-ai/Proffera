import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("customer offer and verified review human UX contract", () => {
  it("keeps direct quote acceptance/rejection secure and bilingual", () => {
    const page = source("src/app/offert/[token]/page.tsx");
    const action = source("src/app/offert/[token]/actions.ts");

    expect(page).toContain("getPublicWorkspaceQuoteOffer(token)");
    expect(page).toContain("publicWorkspaceQuoteOfferPdfPath(token)");
    expect(page).toContain("styles");
    expect(page).toContain("SV");
    expect(page).toContain("EN");
    expect(page).toContain('name="decision" value="accepted"');
    expect(page).toContain('name="decision" value="rejected"');
    expect(action).toContain('decision !== "accepted" && decision !== "rejected"');
  });

  it("keeps one-winner comparison semantics and contact redaction while using the new lifecycle shell", () => {
    const page = source("src/app/offert/jamfor/[token]/page.tsx");
    const action = source("src/app/offert/jamfor/[token]/actions.ts");

    expect(page).toContain("getMarketplaceCustomerComparison(token)");
    expect(page).toContain("directContactRedacted");
    expect(page).toContain('offer.status === "selected"');
    expect(page).toContain('offer.status === "rejected"');
    expect(page).toContain("SV");
    expect(page).toContain("EN");
    expect(action).toContain("allowPublicSubmission");
    expect(action).toContain("selectMarketplaceCustomerOffer(token, offerId)");
  });

  it("keeps job cancellation/rematch behavior and locale state", () => {
    const page = source("src/app/offert/jobb/kund/[token]/page.tsx");

    expect(page).toContain("getMarketplaceServiceJobForCustomerToken(token)");
    expect(page).toContain("getMarketplaceRematchForCustomerToken(token)");
    expect(page).toContain('name="intent" value="cancel"');
    expect(page).toContain('name="intent" value="rematch"');
    expect(page).toContain('name="lang" value={locale}');
    expect(page).toContain("SV");
    expect(page).toContain("EN");
  });

  it("allows review UI language switching without changing verified-review security", () => {
    const page = source("src/app/review/marketplace/[token]/page.tsx");
    const form = source("src/app/review/[token]/verified-review-form.tsx");

    expect(page).toContain("verifiedReviewTokenSchema.safeParse(token)");
    expect(page).toContain("hashVerifiedReviewToken(parsed.data)");
    expect(page).toContain("invitation?.language");
    expect(page).toContain('requested === "en"');
    expect(page).toContain("SV");
    expect(page).toContain("EN");
    expect(form).toContain('name="website"');
    expect(form).toContain("formStartedAtRef");
    expect(form).toContain('fetch(`/api/reviews/${encodeURIComponent(token)}`');
    expect(form).toContain("marketplace_verified_review_submitted");
  });

  it("uses a restrained shared customer lifecycle visual system", () => {
    const styles = source("src/components/customer-lifecycle/customer-lifecycle.module.css");

    expect(styles).toContain("#0a2e63");
    expect(styles).toContain("#1469d8");
    expect(styles).toContain("#eaf8f2");
    expect(styles).toContain(".comparisonGrid");
    expect(styles).toContain(".reviewCard");
    expect(styles).toContain("@media(max-width:760px)");
  });
});
