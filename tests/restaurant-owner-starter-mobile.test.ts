import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  createDonisAdminStarterSite,
  isRestaurantSiteBlank,
} from "../src/lib/donis-fallback";
import {
  emptyRestaurantSite,
  validateRestaurantSite,
} from "../src/lib/restaurant-site-schema";

describe("Doni restaurant owner starter content", () => {
  it("turns the public reference content into an editable starter without external media refs", () => {
    const starter = createDonisAdminStarterSite();

    expect(validateRestaurantSite(starter).ok).toBe(true);
    expect(starter.categories.length).toBeGreaterThanOrEqual(3);
    expect(starter.dishes.length).toBeGreaterThanOrEqual(6);
    expect(starter.text.story.sv).toContain("Doni’s Trattoria");
    expect(starter.hours.some((hour) => !hour.closed)).toBe(true);
    expect(starter.links.order).toContain("qopla.com");
    expect(starter.media.hero).toBeNull();
    expect(starter.media.gallery).toEqual([]);
    expect(starter.dishes.every((dish) => dish.image === null)).toBe(true);
  });

  it("recognizes a truly blank owner site but not the starter", () => {
    expect(isRestaurantSiteBlank(emptyRestaurantSite)).toBe(true);
    expect(isRestaurantSiteBlank(createDonisAdminStarterSite())).toBe(false);
  });

  it("requires starter content to be saved before preview and uses a mobile-first layout", () => {
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );

    expect(editor).toContain("const [dirty, setDirty] = useState(starter)");
    expect(editor).toContain("grid grid-cols-3 gap-2");
    expect(editor).toContain("referenceDishImages[item.id]");
    expect(editor).toContain("Startinnehållet från demosidan är inlagt för redigering");
    expect(editor).not.toContain('filter: "brightness(0)"');
    expect(editor).toContain("sm:sticky sm:bottom-0");
    expect(editor).not.toContain("fixed inset-x-0 bottom-0");
  });

  it("surfaces starter content from blank persisted drafts", () => {
    const db = readFileSync("src/lib/restaurant-site-db.ts", "utf8");

    expect(db).toContain("isRestaurantSiteBlank(draft)");
    expect(db).toContain("createDonisAdminStarterSite()");
    expect(db).toContain("starter,");
  });
});
