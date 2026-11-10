import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { mariaDefaultCardCopy } from "./maria-default-card-copy";

const site = readFileSync(resolve(process.cwd(), "public/demo/makeup-by-maria-v2.html"), "utf8");
const languageDictionaryStart = site.indexOf("const dict={");

describe("Maria dashboard's editable default card copy", () => {
  it("matches all six descriptions customers already see in Design 02", () => {
    expect(languageDictionaryStart).toBeGreaterThan(-1);
    for (const language of ["sv", "en", "ar"] as const) {
      const start = site.indexOf("\n" + language + ":{", languageDictionaryStart);
      expect(start).toBeGreaterThan(-1);
      const end = language === "sv"
        ? site.indexOf("\nen:{", start)
        : language === "en" ? site.indexOf("\nar:{", start) : site.indexOf("\n};", start);
      expect(end).toBeGreaterThan(start);
      const body = site.slice(start, end);
      for (const [kind, field] of [
        ["trial", "trialDesc"],
        ["without-trial", "withoutDesc"],
      ] as const) {
        const actual = body.match(new RegExp(field + ':"([^"]+)"'))?.[1];
        expect(actual).toBe(mariaDefaultCardCopy[kind][language]);
        expect(mariaDefaultCardCopy[kind][language].length).toBeLessThanOrEqual(280);
      }
    }
  });
});
