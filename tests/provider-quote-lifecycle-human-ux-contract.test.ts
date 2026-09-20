import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("provider quote lifecycle human UX contract", () => {
  it("keeps guest quote response privacy and bilingual behavior", () => {
    const page = source("src/app/offert/svara/[token]/page.tsx");

    expect(page).toContain("getMarketplaceGuestQuoteView(token)");
    expect(page).toContain("guestQuoteHref(token, \"sv\"");
    expect(page).toContain("guestQuoteHref(token, \"en\"");
    expect(page).toContain("customerContact");
    expect(page).toContain('name="confirmAuthority"');
    expect(page).toContain('name="lang" value={locale}');
    expect(page).toContain('htmlFor="quote-amount-sek"');
    expect(page).toContain('id="quote-amount-sek"');
    expect(page).toContain('htmlFor="quote-available-date"');
    expect(page).toContain('id="quote-available-date"');
    expect(page).toContain('htmlFor="quote-company-note"');
    expect(page).toContain('id="quote-company-note"');
    expect(page).toContain("providerStyles");
  });

  it("keeps provider service-job transitions and customer contact access intact", () => {
    const page = source("src/app/offert/jobb/[token]/page.tsx");

    expect(page).toContain("getMarketplaceServiceJobForGuestToken(token)");
    expect(page).toContain("getMarketplaceGuestQuoteView(token)");
    expect(page).toContain('name="nextStatus" value="in_progress"');
    expect(page).toContain('name="nextStatus" value="completed"');
    expect(page).toContain('name="nextStatus" value="problem"');
    expect(page).toContain('name="nextStatus" value="provider_cancelled"');
    expect(page).toContain('name="nextStatus" value="no_show"');
    expect(page).toContain('htmlFor="job-completion-summary"');
    expect(page).toContain('id="job-completion-summary"');
    expect(page).toContain('htmlFor="job-problem-reason"');
    expect(page).toContain('id="job-problem-reason"');
    expect(page).toContain('htmlFor="job-cancel-reason"');
    expect(page).toContain('id="job-cancel-reason"');
    expect(page).toContain("SV");
    expect(page).toContain("EN");
  });

  it("keeps guest opt-out token flow bilingual and explicit", () => {
    const page = source("src/app/offert/svara/[token]/avregistrera/page.tsx");

    expect(page).toContain("getMarketplaceGuestOptOutViewWithHistory(token)");
    expect(page).toContain('/api/marketplace/guest-quote/${encodeURIComponent(token)}/opt-out');
    expect(page).toContain('name="lang" value={locale}');
    expect(page).toContain("SV");
    expect(page).toContain("EN");
  });

  it("uses a restrained provider lifecycle visual system", () => {
    const styles = source("src/components/provider-lifecycle/provider-lifecycle.module.css");
    expect(styles).toContain("#0a2e63");
    expect(styles).toContain("#1469d8");
    expect(styles).toContain("#eaf8f2");
    expect(styles).toContain("@media(max-width:720px)");
  });
});
