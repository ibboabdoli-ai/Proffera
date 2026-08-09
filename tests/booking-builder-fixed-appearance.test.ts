import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("booking builder fixed appearance", () => {
  it("keeps preview, saved settings and public rendering on the same theme contract", () => {
    const builder = source("src/app/dashboard/installningar/utseende/booking-page-builder.tsx");
    const experience = source("src/lib/workspace-experience.ts");
    const contract = source("src/lib/booking-theme-contract.ts");
    const templates = source("src/lib/booking-theme-templates.ts");

    expect(contract).toContain('premium: "dark"');
    expect(contract).toContain('restaurant: "dark"');
    expect(contract).toContain('minimal: "light"');

    expect(builder).toContain("normalizeBookingThemeAppearance(initialTheme, settings.appearance)");
    expect(builder).toContain("const resolvedAppearance = normalizeBookingThemeAppearance(themeKey, appearance)");
    expect(builder).toContain('name="appearance" value={resolvedAppearance}');
    expect(builder).toContain("disabled={fixedAppearance}");
    expect(builder).toContain("{themeKey} · {resolvedAppearance}");
    expect(builder).toContain("BOOKING_THEME_TEMPLATES");
    expect(templates).toContain('key: "restaurant"');
    expect(templates).toContain('appearance: "dark"');

    expect(experience).toContain("appearance: normalizeBookingThemeAppearance(themeKey, storedAppearance)");
    expect(experience).toContain("const appearance = normalizeBookingThemeAppearance(input.themeKey, input.appearance)");
  });
});
