import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Directory to quote visitor journey contract", () => {
  const schema = source("src/features/quote-request/schema.ts");
  const localization = source("src/features/quote-request/localization.ts");
  const localizedForm = source("src/features/quote-request/localized-quote-request-form.tsx");
  const swedishQuote = source("src/app/fa-offert/page.tsx");
  const englishQuote = source("src/app/en/get-quote/page.tsx");
  const profile = source("src/components/company-directory/public-directory-profile.tsx");
  const profileCopy = source("src/components/company-directory/public-directory-profile-copy.ts");

  it("adds Directory categories without removing legacy public quote categories", () => {
    for (const category of ["Städning", "VVS", "Elektriker", "Måleri", "Snickeri", "Hemservice", "Hemstädning", "Flyttstädning", "Kontorsstädning", "Fönsterputs", "Byggstädning", "Trädgård", "Flytthjälp", "Renovering"]) {
      expect(schema).toContain(`\"${category}\"`);
    }
  });

  it("localizes the added categories and service types in English", () => {
    expect(localization).toContain('"VVS": "Plumbing"');
    expect(localization).toContain('"Elektriker": "Electrician"');
    expect(localization).toContain('"Måleri": "Painting"');
    expect(localization).toContain('"Snickeri": "Carpentry"');
    expect(localization).toContain('"Hemservice": "Home services"');
    expect(localization).toContain('"Städning / lokalvård": "Cleaning / janitorial services"');
  });

  it("sanitizes query-string prefill before initializing the client form", () => {
    expect(schema).toContain("sanitizeQuoteRequestPrefill");
    expect(schema).toContain("availableServiceTypes.includes(requestedServiceType)");
    expect(localizedForm).toContain("sanitizeQuoteRequestPrefill(initialValues)");
    expect(swedishQuote).toContain("searchParams");
    expect(swedishQuote).toContain("initialValues={initialValues}");
    expect(englishQuote).toContain("searchParams");
    expect(englishQuote).toContain("initialValues={initialValues}");
  });

  it("connects both public profile locales to quote matching with a clear non-targeted disclosure", () => {
    expect(profile).toContain("quoteRequestHref");
    expect(profile).toContain("t.quoteDisclosure");
    expect(profileCopy).toContain("skickas inte automatiskt direkt till företaget");
    expect(profileCopy).toContain("is not automatically sent directly to the company");
    expect(profileCopy).toContain('quoteCta: "Få offertförslag"');
    expect(profileCopy).toContain('quoteCta: "Get quote suggestions"');
  });

  it("does not assume the company's registered city is the customer's job location", () => {
    const quoteCall = profile.match(/const quoteHref = quoteRequestHref\(locale, \{([\s\S]*?)\}\);/)?.[1] ?? "";
    expect(quoteCall).toContain("categorySlug: business.categorySlug");
    expect(quoteCall).not.toContain("city: business.city");
  });
});
