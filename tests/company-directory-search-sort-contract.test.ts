import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PublicDirectorySortControls } from "@/components/company-directory/public-directory-sort-controls";
import { normalizeDirectorySearchSort } from "@/lib/company-directory-public-search";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public directory search sorting", () => {
  it("normalizes invalid and unavailable sort values safely", () => {
    expect(normalizeDirectorySearchSort("recommended", false)).toBe("recommended");
    expect(normalizeDirectorySearchSort("name", false)).toBe("name");
    expect(normalizeDirectorySearchSort("nearest", true)).toBe("nearest");
    expect(normalizeDirectorySearchSort("nearest", false)).toBe("recommended");
    expect(normalizeDirectorySearchSort("sponsored", true)).toBe("recommended");
    expect(normalizeDirectorySearchSort("", true)).toBe("recommended");
  });

  it("keeps sorting bounded to distinct recommended, nearby nearest and alphabetical modes", () => {
    const searchSource = source("src/lib/company-directory-public-search.ts");

    expect(searchSource).toContain('export type DirectorySearchSort = "recommended" | "nearest" | "name"');
    expect(searchSource).toContain("case when ${sort} = 'nearest' and ${nearbyEnabled} = true then distance_km end asc nulls last");
    expect(searchSource).toContain("case when ${sort} = 'recommended' then quality_score end desc nulls last");
    expect(searchSource).toContain("case when ${sort} = 'recommended' and ${nearbyEnabled} = true then distance_km end asc nulls last");
    expect(searchSource).toContain("case when ${sort} = 'nearest' then quality_score end desc nulls last");
    expect(searchSource).toContain("case when ${sort} = 'name' then lower(display_name) end asc nulls last");
    expect(searchSource).toContain("display_name asc,\n      id asc");
  });

  it("does not use plan or entitlement state as a ranking signal", () => {
    const searchSource = source("src/lib/company-directory-public-search.ts");
    const orderBy = searchSource.split("order by\n      case when ${sort}")[1]?.split("limit ${pageSize}")[0] ?? "";

    expect(orderBy).toContain("quality_score");
    expect(orderBy).toContain("distance_km");
    expect(orderBy).toContain("display_name");
    expect(orderBy).not.toContain("planAccess");
    expect(orderBy).not.toContain("websiteBuilder");
    expect(orderBy).not.toContain("onlineBooking");
    expect(orderBy).not.toContain("claimed_workspace");
  });

  it("renders localized controls and preserves sanitized search state while resetting pagination", () => {
    const sv = renderToStaticMarkup(createElement(PublicDirectorySortControls, {
      locale: "sv",
      sort: "name",
      nearbyActive: true,
      baseHref: "/foretag/listad?service=vvs&nearby=1&radius=25&sort=name&page=3",
    }));
    const en = renderToStaticMarkup(createElement(PublicDirectorySortControls, {
      locale: "en",
      sort: "recommended",
      nearbyActive: false,
      baseHref: "/en/companies?service=Plumber&location=Stockholm&page=2",
    }));

    expect(sv).toContain("Sortera");
    expect(sv).toContain("Rekommenderade");
    expect(sv).toContain("Närmaste");
    expect(sv).toContain("A–Ö");
    expect(sv).toContain('data-search-sort="name" aria-current="page"');
    expect(sv).toContain('href="/foretag/listad?service=vvs&amp;nearby=1&amp;radius=25"');
    expect(sv).toContain('href="/foretag/listad?service=vvs&amp;nearby=1&amp;radius=25&amp;sort=nearest"');
    expect(sv).toContain('href="/foretag/listad?service=vvs&amp;nearby=1&amp;radius=25&amp;sort=name"');
    expect(sv).not.toContain("latitude=");
    expect(sv).not.toContain("longitude=");
    expect(sv).not.toContain("page=3");

    expect(en).toContain("Sort");
    expect(en).toContain("Recommended");
    expect(en).toContain("A–Z");
    expect(en).not.toContain("Nearest");
    expect(en).toContain('data-search-sort="recommended" aria-current="page"');
    expect(en).toContain('href="/en/companies?service=Plumber&amp;location=Stockholm"');
    expect(en).toContain('href="/en/companies?service=Plumber&amp;location=Stockholm&amp;sort=name"');
    expect(en).not.toContain("nearby=1");
    expect(en).not.toContain("page=2");
  });
});
