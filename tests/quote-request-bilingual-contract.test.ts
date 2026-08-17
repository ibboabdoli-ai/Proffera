import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { quoteCategoryLabel, quoteServiceTypeLabel } from "../src/features/quote-request/localization";
import { createQuoteRequestSchema, serviceTypesByCategory } from "../src/features/quote-request/schema";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }

describe("bilingual quote request contract", () => {
  it("localizes validation without changing canonical stored values", () => {
    const invalid = createQuoteRequestSchema("en").safeParse({
      category: "Hemstädning", serviceType: "Engångsstädning", city: "Malmö", postalCode: "211 20",
      description: "A sufficiently detailed cleaning request for a home.", preferredDate: "Inom 1 vecka",
      contactName: "Anna Andersson", contactEmail: "bad", contactPhone: "+46 70 123 45 67", consentAccepted: true,
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues.some((issue) => issue.message === "Enter a valid email address.")).toBe(true);
    expect(serviceTypesByCategory["Hemstädning"][0]).toBe("Engångsstädning");
    expect(quoteCategoryLabel("Hemstädning", "en")).toBe("Home cleaning");
    expect(quoteServiceTypeLabel("Engångsstädning", "en")).toBe("One-time cleaning");
  });

  it("provides separate Swedish and English public quote pages", () => {
    const sv = source("src/app/fa-offert/page.tsx");
    const en = source("src/app/en/get-quote/page.tsx");
    expect(sv).toContain('locale="sv"');
    expect(sv).toContain('/en/get-quote');
    expect(en).toContain('locale="en"');
    expect(en).toContain('/fa-offert');
  });

  it("keeps the directory CTA honest about generic matching", () => {
    const results = source("src/components/company-directory/public-directory-results.tsx");
    const copy = source("src/components/company-directory/public-directory-copy.ts");
    const persistence = source("src/features/quote-request/persistence.ts");
    expect(results).toContain("quoteRequestPaths[locale]");
    expect(copy).toContain("hjälp att hitta lämpliga företag");
    expect(copy).toContain("help finding suitable businesses");
    expect(copy).toContain('getQuotes: "Få offerter"');
    expect(copy).toContain('getQuotes: "Get quotes"');
    expect(persistence).not.toContain("target_company");
  });
});
