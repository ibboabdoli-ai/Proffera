import { describe, expect, it } from "vitest";
import { localizeMariaPreviewServiceName as translate } from "./maria-preview-service-copy";

describe("Maria customer portal service names", () => {
  it.each([
    ["Brudsmink med prov 2026", "en", "Bridal makeup with trial 2026"],
    ["Brudsmink utan prov 2028", "en", "Bridal makeup without trial 2028"],
    ["Brudsmink med prov 2026", "ar", "مكياج العروس مع تجربة ٢٠٢٦"],
    ["Brudsmink utan prov 2028", "ar", "مكياج العروس بدون تجربة ٢٠٢٨"],
    ["Brudsmink med prov 2026", "sv", "Brudsmink med prov 2026"],
  ] as const)("uses localized display copy: %s / %s", (name, lang, expected) => {
    expect(translate(name, lang, true)).toBe(expected);
  });
  it("never changes other tenants or unrecognized service names", () => {
    expect(translate("Brudsmink med prov 2026", "ar", false)).toBe("Brudsmink med prov 2026");
    expect(translate("Haircut 2026", "ar", true)).toBe("Haircut 2026");
    expect(translate("Brudsmink med prov 2040", "en", true)).toBe("Brudsmink med prov 2040");
    expect(translate("Custom Brudsmink med prov 2026", "en", true)).toBe("Custom Brudsmink med prov 2026");
  });
});
