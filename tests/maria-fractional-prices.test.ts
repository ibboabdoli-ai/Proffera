import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

type MariaYear = { year: number; enabled: boolean; trial: unknown; without: unknown };

const page = readFileSync(resolve(process.cwd(), "public/demo/makeup-by-maria-v2.html"), "utf8");

function segment(start: string, end: string) {
  const first = page.indexOf(start);
  const last = first < 0 ? -1 : page.indexOf(end, first + start.length);
  if (first < 0 || last < 0) throw new Error("Maria price script segment not found");
  return page.slice(first, last);
}

function parseAndDisplay(years: MariaYear[], year: number, lang: "sv" | "en" = "sv") {
  // Execute the actual inline page price validation and formatter, not a duplicate.
  const js = [
    segment("function isValidYearPrice(amount){", "function isBookablePackage(year,kind){"),
    // Include the real normalization helper used by the public three-language
    // card payload; the extracted parser must run with its actual dependencies.
    segment("  function safeDescriptions(value){", "  if(Array.isArray(config.years)){"),
    segment("   const parsed=config.years\n", "   if(new Set(parsed.map("),
    'workspaceConfig.years=parsed; ({years:parsed.map(row=>row.year),trial:displayYearPrice("trial"),without:displayYearPrice("without")})',
  ].join("\n");
  return runInNewContext(js, {
    config: { years },
    workspaceConfig: { years: [] },
    state: { year, lang },
    copy: () => ({ currency: "SEK", requestPrice: "Pris på förfrågan" }),
  }, { timeout: 1000 }) as { years: number[]; trial: string; without: string };
}

const normalSpaces = (s: string) => s.replace(/\s/g, " ");

describe("Maria Design 02 fractional SEK pricing", () => {
  it("retains the bookable year and preserves öre in Swedish and English", () => {
    const years = [{ year: 2026, enabled: true, trial: 6900.5, without: 5800 }];
    const sv = parseAndDisplay(years, 2026);
    expect(Array.from(sv.years)).toEqual([2026]);
    expect(normalSpaces(sv.trial)).toBe("6 900,50 SEK");
    expect(normalSpaces(sv.without)).toBe("5 800 SEK");
    const en = parseAndDisplay(years, 2026, "en");
    expect(en.trial).toBe("6,900.50 SEK");
    expect(en.without).toBe("5,800 SEK");
  });

  it("preserves quote pricing and valid one-öre prices", () => {
    const result = parseAndDisplay([{ year: 2027, enabled: true, trial: null, without: 0.01 }], 2027);
    expect(Array.from(result.years)).toEqual([2027]);
    expect(result.trial).toBe("Pris på förfrågan");
    expect(result.without).toBe("0,01 SEK");
  });

  it("rejects invalid amounts without hiding other valid years", () => {
    const years = [
      { year: 2026, enabled: true, trial: 6900.5, without: 5800 },
      { year: 2027, enabled: true, trial: 250000, without: null },
      { year: 2028, enabled: true, trial: 6900.005, without: 5800 },
      { year: 2029, enabled: true, trial: "6900.5", without: 5800 },
      { year: 2030, enabled: true, trial: -1, without: 5800 },
      { year: 2031, enabled: true, trial: 250000.01, without: 5800 },
    ];
    expect(Array.from(parseAndDisplay(years, 2026).years)).toEqual([2026, 2027]);
  });
});
