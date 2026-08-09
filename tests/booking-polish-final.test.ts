import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("final public booking polish", () => {
  it("renders booking success as a dedicated state with a fresh-booking action", () => {
    const page = source("src/app/boka/[slug]/page.tsx");

    expect(page).toContain("data-booking-success");
    expect(page).toContain("Gör en ny bokning");
    expect(page).toContain("Make another booking");
    expect(page).toContain("!booked && services.length && publishedHours.length");
    expect(page).toContain("booked ? successNotice");
  });

  it("adds concise service-first guidance in Swedish and English", () => {
    const page = source("src/app/boka/[slug]/page.tsx");

    expect(page).toContain("Välj först en tjänst");
    expect(page).toContain("Choose a service first");
    expect(page).toContain("data-booking-start-hint");
  });

  it("loads one shared final polish layer for all booking themes", () => {
    const layout = source("src/app/boka/[slug]/layout.tsx");
    const css = source("src/app/boka/[slug]/booking-polish.css");

    expect(layout).toContain('import "./booking-polish.css"');
    expect(css).toContain("[data-booking-theme] [data-booking-success]");
    expect(css).toContain("[data-booking-theme] [data-booking-start-hint]");
    expect(css).toContain("@media (max-width: 640px)");
  });
});
