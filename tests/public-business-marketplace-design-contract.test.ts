import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public business marketplace visual contract", () => {
  it("keeps the claimed company page human-designed while preserving tenant branding", () => {
    const page = source("src/app/foretag/[workspace]/page.tsx");
    const styles = source("src/app/foretag/[workspace]/public-business-page.module.css");

    expect(page).toContain("--business-primary");
    expect(page).toContain("--business-card");
    expect(page).toContain("--business-text");
    expect(page).toContain("styles.hero");
    expect(page).toContain("styles.serviceList");
    expect(page).toContain("styles.reviewGrid");
    expect(page).toContain("PublicBusinessContactForm");
    expect(page).toContain('href="#tjanster"');
    expect(page).toContain('href="#kontakt"');
    expect(styles).toContain("grid-template-columns: 150px minmax(0,1fr) auto");
    expect(styles).toContain("prefers-reduced-motion");
  });

  it("keeps service detail conversion behavior while aligning the visual shell", () => {
    const page = source("src/app/foretag/[workspace]/tjanster/[service]/page.tsx");
    const styles = source("src/app/foretag/[workspace]/tjanster/[service]/public-service-page.module.css");

    expect(page).toContain("styles.hero");
    expect(page).toContain('eventKey="book_clicked"');
    expect(page).toContain('eventKey="quote_clicked"');
    expect(page).toContain('eventKey="contact_clicked"');
    expect(page).toContain("scroll-mt-24");
    expect(page).toContain("fixed inset-x-0 bottom-0 z-40");
    expect(styles).toContain("background: var(--business-bg");
    expect(styles).toContain("color: var(--business-primary)");
  });
});
