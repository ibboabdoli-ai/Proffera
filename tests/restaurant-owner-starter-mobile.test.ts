import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isRestaurantSiteBlank } from "../src/lib/donis-fallback";
import { createDonisLuxuryAdminStarterSite } from "../src/lib/donis-luxury-fallback";
import {
  emptyRestaurantSite,
  validateRestaurantSite,
} from "../src/lib/restaurant-site-schema";

describe("Doni restaurant owner starter content", () => {
  it("turns the premium public reference into an editable CMS starter", () => {
    const starter = createDonisLuxuryAdminStarterSite();

    expect(validateRestaurantSite(starter).ok).toBe(true);
    expect(starter.categories.length).toBeGreaterThanOrEqual(3);
    expect(starter.dishes.length).toBeGreaterThanOrEqual(6);
    expect(starter.text.story.sv).toContain("Doni’s Trattoria");
    expect(starter.hours.some((hour) => !hour.closed)).toBe(true);
    expect(starter.links.order).toContain("qopla.com");
    expect(starter.media.hero).not.toBeNull();
    expect(starter.media.gallery.length).toBeGreaterThanOrEqual(7);
    expect(starter.dishes.some((dish) => dish.image !== null)).toBe(true);
    expect(starter.dishes.filter((dish) => dish.priceOre === null).every((dish) => dish.hidden)).toBe(true);
    expect(starter.contact?.addressLine1).toBe("Hornsbergs Strand 77");
  });

  it("recognizes a truly blank owner site but not the starter", () => {
    expect(isRestaurantSiteBlank(emptyRestaurantSite)).toBe(true);
    expect(isRestaurantSiteBlank(createDonisLuxuryAdminStarterSite())).toBe(false);
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
    expect(db).toContain("createDonisLuxuryAdminStarterSite()");
    expect(db).toContain("starter,");
  });
});
