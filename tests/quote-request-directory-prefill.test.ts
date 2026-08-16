import { describe, expect, it } from "vitest";

import { directoryQuotePrefill, quoteRequestHref } from "@/features/quote-request/directory-prefill";
import { isServiceCategory, sanitizeQuoteRequestPrefill, serviceTypesByCategory } from "@/features/quote-request/schema";

const directoryCases = [
  ["vvs", "vvs"], ["vvs", "avloppsrensning"], ["vvs", "vattenlacka"], ["vvs", "varmepump"],
  ["elektriker", "elinstallation"], ["elektriker", "felsokning-el"], ["elektriker", "laddbox"], ["elektriker", "elcentral"],
  ["stadning", "lokalvard"], ["stadning", "hemstadning"], ["stadning", "kontorsstadning"], ["stadning", "flyttstadning"], ["stadning", "fonsterputsning"],
  ["maleri", "malning"], ["snickeri", "snickeri"], ["flytt", "flytthjalp"], ["tradgard", "tradgardshjalp"], ["hemservice", "hemservice"],
] as const;

describe("Company Directory quote prefill", () => {
  it("maps every public Directory service to a valid quote category and valid exact service when available", () => {
    for (const [categorySlug, serviceSlug] of directoryCases) {
      const prefill = directoryQuotePrefill({ categorySlug, serviceSlug, city: "Stockholm" });
      expect(isServiceCategory(prefill.category ?? "")).toBe(true);
      expect(prefill.city).toBe("Stockholm");
      if (prefill.serviceType) {
        expect((serviceTypesByCategory[prefill.category as keyof typeof serviceTypesByCategory] as readonly string[])).toContain(prefill.serviceType);
      }
    }
  });

  it("falls back to the Directory category without guessing an unknown service", () => {
    expect(directoryQuotePrefill({ categorySlug: "vvs", serviceSlug: "unknown", city: "Södertälje" })).toEqual({
      category: "VVS",
      serviceType: "",
      city: "Södertälje",
    });
  });

  it("rejects manipulated category and category-service combinations", () => {
    expect(sanitizeQuoteRequestPrefill({ category: "Not real", serviceType: "Målning", city: " Stockholm " })).toEqual({
      category: "",
      serviceType: "",
      city: "Stockholm",
    });
    expect(sanitizeQuoteRequestPrefill({ category: "VVS", serviceType: "Målning", city: "Uppsala" })).toEqual({
      category: "VVS",
      serviceType: "",
      city: "Uppsala",
    });
  });

  it("builds locale-aware quote links with sanitized prefill values", () => {
    const sv = new URL(quoteRequestHref("sv", { categorySlug: "elektriker", serviceSlug: "laddbox", city: "Stockholm" }), "https://proffera.se");
    expect(sv.pathname).toBe("/fa-offert");
    expect(sv.searchParams.get("category")).toBe("Elektriker");
    expect(sv.searchParams.get("service")).toBe("Laddbox");
    expect(sv.searchParams.get("city")).toBe("Stockholm");

    const en = new URL(quoteRequestHref("en", { categorySlug: "maleri", serviceSlug: "malning", city: "Malmö" }), "https://proffera.se");
    expect(en.pathname).toBe("/en/get-quote");
    expect(en.searchParams.get("category")).toBe("Måleri");
    expect(en.searchParams.get("service")).toBe("Målning");
  });
});
