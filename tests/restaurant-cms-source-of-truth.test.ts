import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Doni restaurant CMS source of truth", () => {
  it("stores public business identity and bilingual dish names in the restaurant site model", () => {
    const schema = readFileSync("src/lib/restaurant-site-schema.ts", "utf8");
    expect(schema).toContain("nameEn:");
    expect(schema).toContain("business: z.object");
    expect(schema).toContain("const phoneOrEmpty = z");
    expect(schema).toContain("phone: phoneOrEmpty");
    for (const field of [
      "address",
      "postalCode",
      "city",
      "phone",
      "email",
      "instagram",
      "instagramUrl",
      "orgNumber",
      "mapUrl",
    ]) {
      expect(schema).toContain(field + ":");
    }
  });

  it("uses the luxury Demo 2 content as the editable owner starter", () => {
    const db = readFileSync("src/lib/restaurant-site-db.ts", "utf8");
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );
    const page = readFileSync(
      "src/app/dashboard/restaurang/page.tsx",
      "utf8",
    );

    expect(db).toContain("createDonisLuxuryAdminStarterSite()");
    expect(db).toContain("DONIS_LUXURY_BUILTIN_IMAGES");
    expect(editor).toContain("createDonisLuxuryAdminStarterSite()");
    expect(editor).toContain('id: "business"');
    expect(editor).toContain("Dish name EN");
    expect(editor).toContain("site.business[field]");
    expect(page).toContain("DONIS_LUXURY_FALLBACK_SITE.dishes");
    expect(page).toContain("referenceItems");
  });

  it("previews and publishes against the same Demo 2 presentation", () => {
    const preview = readFileSync(
      "src/app/dashboard/restaurang/forhandsgranska/page.tsx",
      "utf8",
    );
    const demo = readFileSync(
      "src/app/demo/donis-trattoria2/demo-interactions.tsx",
      "utf8",
    );

    expect(preview).toContain("DonisTrattoriaLuxuryExperience");
    expect(preview).toContain("initialLang={locale}");
    expect(demo).toContain("const business = displaySite.business");
    expect(demo).toContain("dish.nameEn?.trim()");
    expect(demo).toContain("business.orgNumber");
    expect(demo).toContain("business.mapUrl");
    expect(demo).not.toContain('const phoneHref = "tel:+4686568400"');
    expect(demo).toContain("const locationFeature =");
    expect(demo).toContain("const mapTitle = fullAddress");
    expect(demo).toContain("const footerLine = business.city");
    expect(demo).toContain("{text.menuIntro[lang]}");
    expect(demo).not.toContain("{text.menuIntro[lang] || t.menuIntro}");
    expect(demo).not.toContain("{text.galleryIntro[lang] || t.galleryIntro}");
    expect(demo).not.toContain("{text.contactBody[lang] || t.contactBody}");
    expect(demo).not.toContain("{text.menuTitle[lang] || t.menuTitle}");
    expect(demo).not.toContain("{text.galleryTitle[lang] || t.galleryTitle}");
    expect(demo).not.toContain("{text.contactTitle[lang] || t.contactTitle}");
    expect(demo).not.toContain("currentOrderUrl");
    expect(demo).toContain("const order = displaySite.links.order;");
    expect(demo).toContain("{order && (");
  });
});
