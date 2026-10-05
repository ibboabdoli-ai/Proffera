import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Doni restaurant CMS source of truth", () => {
  it("stores public business identity and bilingual dish names in the restaurant site model", () => {
    const schema = readFileSync("src/lib/restaurant-site-schema.ts", "utf8");
    expect(schema).toContain("nameEn:");
    expect(schema).toContain("business: z");
    expect(schema).toContain(".superRefine((business, ctx) =>");
    expect(schema).toContain("const phoneOrEmpty = z");
    expect(schema).toContain("phone: phoneOrEmpty");
    expect(schema).toContain("instagram: instagramHandleOrEmpty");
    expect(schema).toContain("instagramUrl: instagramUrlOrEmpty");
    expect(schema).toContain('name: z.string().trim().min(1).max(120)');
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
    expect(editor).toContain('field === "address"');
    expect(editor).toContain("next.business.mapUrl = \"\"");
    expect(editor).toContain('field === "instagram"');
    expect(editor).toContain("next.business.instagramUrl = \"\"");
    expect(page).toContain("DONIS_LUXURY_FALLBACK_SITE.dishes");
    expect(page).toContain("referenceItems");
    expect(page).toContain("alt: item.alt");
    expect(page).toContain("alt: { sv: altText, en: altText }");
    expect(editor).toContain("type LocalizedAlt = { sv: string; en: string }");
    expect(editor).toContain("? { id: media.id, alt: media.alt }");
    expect(editor).toContain("alt: first.alt");
    expect(editor).not.toContain("alt: { sv: first.alt, en: first.alt }");
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
    expect(demo).toContain("const bookingHref = booking || phoneHref");
    expect(demo).not.toContain('booking || phoneHref || "#kontakt"');
    expect(demo.split("{bookingHref && (").length - 1).toBe(4);
    expect(demo).toContain("const locationFeature =");
    expect(demo).toContain("const mapTitle = fullAddress");
    expect(demo).toContain("const footerLine = business.city");
    expect(demo).toContain("const showDonisLogo = normalizedBrandName === \"doni's trattoria\"");
    expect(demo.split("{showDonisLogo && (").length - 1).toBe(2);
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
    expect(demo).toContain("? heroFallback");
    expect(demo).toContain(": null;");
    expect(demo).toContain("{hero && (");
    expect(demo).toContain("const hasLocation = Boolean(fullAddress || business.mapUrl)");
    expect(demo).toContain("{fullAddress && (");
    expect(demo).toContain("{hasLocation && (");
    expect(demo).toContain("{mapEmbedUrl && (");
  });

  it("generates Demo 2 browser and social metadata from the published CMS document", () => {
    const page = readFileSync(
      "src/app/demo/donis-trattoria2/page.tsx",
      "utf8",
    );

    expect(page).toContain("export async function generateMetadata()");
    expect(page).toContain("const business = displaySite.business");
    expect(page).toContain("const name = business.name");
    expect(page).toContain("business.city");
    expect(page).toContain("displaySite.text.heroDescription.sv.trim()");
    expect(page).toContain("siteName: name");
    expect(page).not.toContain("Doni’s Trattoria | Premium concept");
    expect(page).not.toContain("Premium mörk restaurangdemo");
  });
});
