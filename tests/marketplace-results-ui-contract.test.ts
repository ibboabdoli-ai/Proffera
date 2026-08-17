import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("marketplace results UI contract", () => {
  const results = source("src/components/company-directory/public-directory-results.tsx");
  const searchPage = source("src/components/company-directory/public-directory-search-page.tsx");
  const searchForm = source("src/components/company-directory/public-directory-search-form.tsx");
  const copy = source("src/components/company-directory/public-directory-copy.ts");

  it("keeps official company prose out of the comparison cards", () => {
    expect(results).not.toContain("result.activityDescription");
    expect(results).not.toContain("compactDescription");
    expect(results).toContain("t.verifiedDetails");
    expect(results).toContain("registeredLocation(result, locale)");
  });

  it("preserves safe Marketplace actions and the Directory fallback", () => {
    expect(results).toContain("result.bookingAvailable && result.claimedBookingSlug");
    expect(results).toContain('result.conversionMode === "quote" || result.conversionMode === "book_or_quote"');
    expect(results).toContain('result.conversionMode === "contact"');
    expect(results).toContain("marketplace.companyHref");
    expect(results).toContain("${profileBase}/${encodeURIComponent(result.slug)}");
  });

  it("uses a light compact search surface on the results page", () => {
    expect(searchPage).toContain('tone="light"');
    expect(searchPage).toContain("border border-line bg-surface");
    expect(searchPage).not.toContain("rounded-panel bg-brand-deep");
    expect(searchForm).toContain('tone?: "light" | "dark"');
  });

  it("uses customer-facing Swedish and English result copy", () => {
    expect(copy).toContain('verifiedDetails: "Företagsuppgifter verifierade"');
    expect(copy).toContain('book: "Boka tid"');
    expect(copy).toContain('verifiedDetails: "Company details verified"');
    expect(copy).toContain('book: "Book appointment"');
    expect(copy).toContain("Bekräftat serviceområde visas separat");
    expect(copy).toContain("Confirmed service area is shown separately");
  });
});
