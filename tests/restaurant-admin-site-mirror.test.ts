import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Doni admin mirrors the public demo", () => {
  it("offers an explicit safe demo-loader for non-published drafts", () => {
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );

    expect(editor).toContain("function loadDemoExamples()");
    expect(editor).toContain("createDonisLuxuryAdminStarterSite()");
    expect(editor).toContain("Ladda demosidans exempel");
    expect(editor).toContain("setStarter(true)");
    expect(editor).toContain("setDirty(true)");
    expect(editor).toContain("!initial.published");
  });

  it("labels each owner section by the public-site area it controls", () => {
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );

    for (const label of [
      "Rätter och priser",
      "Rubriker i menyn",
      "Hero, galleri och matbilder",
      "Hero och Om oss",
      "Adress, telefon och socialt",
      "Kontaktsektionen",
      "Qopla och bokning",
      "På webbplatsen: Meny",
      "På webbplatsen: Hero och Om oss",
      "På webbplatsen: Kontakt / Hitta hit / Footer",
      "På webbplatsen: Kontakt / Öppettider",
    ]) {
      expect(editor).toContain(label);
    }
  });

  it("shows public reference media without converting it into owned media", () => {
    const page = readFileSync(
      "src/app/dashboard/restaurang/page.tsx",
      "utf8",
    );
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );

    expect(page).toContain("referenceHeroImage={referenceHeroImage}");
    expect(page).toContain("referenceGalleryImages={referenceGalleryImages}");
    expect(page).toContain("site.published ? {} : DONIS_LUXURY_DISH_IMAGE_URLS");
    expect(page).toContain("getDonisLuxuryBuiltinMedia()");
    expect(editor).toContain("Referensbilder från demosidan");
    expect(editor).toContain("referenceDishImages[dish.id]");
    expect(editor).toContain("referenceHeroImage");
    expect(editor).toContain("referenceGalleryImages");
  });

  it("keeps menu description fields editable without inventing dish copy", () => {
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );

    expect(editor).toContain(
      "Skriv en kort beskrivning av rätten på svenska.",
    );
    expect(editor).toContain(
      "Write a short description of the dish in English.",
    );
  });
});


describe("Doni admin authoritative CMS controls", () => {
  it("edits bilingual dish names and customer contact details", () => {
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );
    expect(editor).toContain("Namn SV");
    expect(editor).toContain("Namn EN");
    expect(editor).toContain('id: "contact"');
    expect(editor).toContain("Postnummer och ort");
    expect(editor).toContain("Org.nr");
    expect(editor).toContain("next.contact[field]");
  });

  it("previews the same premium experience that Demo 2 publishes", () => {
    const preview = readFileSync(
      "src/app/dashboard/restaurang/forhandsgranska/page.tsx",
      "utf8",
    );
    expect(preview).toContain("DonisTrattoriaLuxuryExperience");
    expect(preview).toContain("@/app/demo/donis-trattoria2/demo-interactions");
  });
});
