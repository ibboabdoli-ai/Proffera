import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Public Business Hub conversion polish", () => {
  it("makes service cards visually complete and explains the next action", () => {
    const companyPage = source("src/app/foretag/[workspace]/page.tsx");
    const locale = source("src/lib/public-business-locale.ts");

    expect(companyPage).toContain("companyCopy.serviceMode[service.conversionMode]");
    expect(companyPage).toContain("companyCopy.viewService");
    expect(companyPage).toContain("service.name.slice(0, 1).toUpperCase()");
    expect(locale).toContain('book_or_quote: "Bokning eller offert"');
    expect(locale).toContain('book_or_quote: "Booking or quote"');
  });

  it("keeps the primary service conversion action reachable on mobile", () => {
    const servicePage = source("src/app/foretag/[workspace]/tjanster/[service]/page.tsx");

    expect(servicePage).toContain("fixed inset-x-0 bottom-0 z-40");
    expect(servicePage).toContain("env(safe-area-inset-bottom)");
    expect(servicePage).toContain('eventKey="book_clicked"');
    expect(servicePage).toContain('eventKey="quote_clicked"');
    expect(servicePage).toContain('eventKey="contact_clicked"');
    expect(servicePage).toContain("scroll-mt-24");
  });

  it("does not duplicate desktop conversion controls on small screens", () => {
    const servicePage = source("src/app/foretag/[workspace]/tjanster/[service]/page.tsx");
    expect(servicePage).toContain('className="mt-8 hidden flex-wrap gap-3 lg:flex"');
    expect(servicePage).toContain("lg:hidden");
  });
});
