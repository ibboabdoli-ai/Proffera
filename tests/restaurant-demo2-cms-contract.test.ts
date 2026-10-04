import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Doni Demo 2 CMS ownership contract", () => {
  it("uses the luxury Demo 2 starter and permits its bundled media to survive save/publish", () => {
    const db = readFileSync("src/lib/restaurant-site-db.ts", "utf8");
    const fallback = readFileSync("src/lib/donis-luxury-fallback.ts", "utf8");

    expect(db).toContain("createDonisLuxuryAdminStarterSite()");
    expect(db).toContain("DONIS_LUXURY_FALLBACK_IMAGES");
    expect(db).toContain("isDonisLuxuryBundledMediaId");
    expect(db).toContain("const workspaceMediaIds = mediaIds.filter");
    expect(db).toContain("any(${workspaceMediaIds}::text[])");
    expect(db).toContain("workspaceMediaIds.length");
    expect(fallback).toContain("createDonisLuxuryAdminStarterSite");
    expect(fallback).toContain("DONIS_LUXURY_FALLBACK_DISH_IMAGE_URLS");
  });

  it("lets the owner edit localized dish names and real business contact data", () => {
    const schema = readFileSync("src/lib/restaurant-site-schema.ts", "utf8");
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );

    expect(schema).toContain("displayName: localized.optional()");
    expect(schema).toContain("contact: contact.optional()");
    expect(schema).toContain("contactTitle: localized.optional()");
    expect(schema).toContain("contactDescription: localized.optional()");

    expect(editor).toContain("Rättens namn SV");
    expect(editor).toContain("Dish name EN");
    expect(editor).toContain('id: "contact"');
    expect(editor).toContain("Google Maps / Hitta hit-länk");
    expect(editor).toContain("next.contact ??=");
  });

  it("previews and opens the same Demo 2 experience that is published", () => {
    const adminPage = readFileSync(
      "src/app/dashboard/restaurang/page.tsx",
      "utf8",
    );
    const preview = readFileSync(
      "src/app/dashboard/restaurang/forhandsgranska/page.tsx",
      "utf8",
    );
    const demo = readFileSync(
      "src/app/demo/donis-trattoria2/demo-interactions.tsx",
      "utf8",
    );

    expect(adminPage).toContain('href="/demo/donis-trattoria2"');
    expect(preview).toContain("DonisTrattoriaLuxuryExperience");
    expect(demo).toContain("dish.displayName?.[lang]");
    expect(demo).toContain("displaySite.contact ?? DONIS_LUXURY_FALLBACK_SITE.contact!");
    expect(demo).toContain("text.contactTitle?.[lang]");
    expect(demo).toContain("text.contactDescription?.[lang]");
  });
});
