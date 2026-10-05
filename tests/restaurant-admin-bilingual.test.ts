import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Doni restaurant admin bilingual flow", () => {
  it("translates the restaurant owner editor when dashboard language is English", () => {
    const source = readFileSync(
      "src/components/dashboard/dashboard-global-locale-boundary.tsx",
      "utf8",
    );

    expect(source).toContain('"Hantera restaurangen": "Manage the restaurant"');
    expect(source).toContain('"Spara utkast": "Save draft"');
    expect(source).toContain('"Bokning och beställning": "Booking and ordering"');
    expect(source).toContain('"Öppna restaurangens webbplats ↗": "Open restaurant website ↗"');
    expect(source).toContain('root.querySelectorAll("[aria-label], [title]")');
  });

  it("keeps the selected language through edit and preview", () => {
    const editor = readFileSync(
      "src/app/dashboard/restaurang/restaurant-editor.tsx",
      "utf8",
    );
    const preview = readFileSync(
      "src/app/dashboard/restaurang/forhandsgranska/page.tsx",
      "utf8",
    );
    const publicExperience = readFileSync(
      "src/app/demo/donis-trattoria2/demo-interactions.tsx",
      "utf8",
    );

    expect(editor).toContain('const locale = searchParams.get("lang") === "en" ? "en" : "sv"');
    expect(editor).toContain('"/dashboard/restaurang/forhandsgranska?lang=en"');
    expect(editor).toContain('category.name[locale] || category.name.sv');
    expect(editor).toContain('"You have unsaved changes. Leave this page and discard them?"');

    expect(preview).toContain('<input type="hidden" name="lang" value={locale} />');
    expect(preview).toContain('initialLang={locale}');
    expect(preview).toContain('"Preview of saved draft"');

    expect(publicExperience).toContain('initialLang = "sv"');
    expect(publicExperience).toContain('const [lang, setLang] = useState<Lang>(initialLang)');
  });
});
