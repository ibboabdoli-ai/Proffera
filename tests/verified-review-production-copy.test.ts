import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("verified review production copy", () => {
  it("uses an absolute review-page title without duplicate branding", () => {
    const page = source("src/app/review/[token]/page.tsx");

    expect(page).toContain('title: { absolute: "Verified customer review" }');
    expect(page).not.toContain('title: "Verified customer review | Proffera"');
  });

  it("keeps PrimeView review copy consistent with secure invitations", () => {
    const page = source("src/app/demo/primeview/page.tsx");

    expect(page).toContain("Verified customer reviews");
    expect(page).toContain("secure single-use review link");
    expect(page).toContain("review.isVerified");
    expect(page).toContain("Verified customer");
    expect(page).toContain("appleWebApp");
    expect(page).not.toContain("or share your own experience with the team");
    expect(page).not.toContain("Be the first to share your experience");
    expect(page).not.toContain("It takes less than a minute");
  });
});
