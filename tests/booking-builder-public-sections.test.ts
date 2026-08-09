import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("booking builder public section parity", () => {
  it("renders approved verified reviews when reviews are enabled", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");
    const reviews = source("src/lib/website-reviews-db.ts");

    expect(layout).toContain("experience.reviewsEnabled");
    expect(layout).toContain("getPublishedWebsiteReviews(workspaceSlug)");
    expect(layout).toContain("data-booking-reviews");
    expect(layout).toContain("Verifierad kund");
    expect(reviews).toContain("review.status = 'approved'");
    expect(reviews).toContain("review.is_verified = true");
  });

  it("shows only safe public staff fields for active staff", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");

    expect(layout).toContain("experience.staffEnabled");
    expect(layout).toContain("select id, name, role_label");
    expect(layout).toContain("and is_active = true");
    expect(layout).toContain("data-booking-staff");
    expect(layout).not.toContain("select id, name, email, phone");
  });

  it("keeps the bespoke Julius presentation from receiving duplicate generic review and staff sections", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");
    expect(layout).toContain('if (slug !== "julius-salong")');
  });
});