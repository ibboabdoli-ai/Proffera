import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PublicDirectorySortControls } from "@/components/company-directory/public-directory-sort-controls";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public directory search sorting", () => {
  it("keeps sorting bounded to recommended, nearby nearest and alphabetical modes", () => {
    const searchSource = source("src/lib/company-directory-public-search.ts");

    expect(searchSource).toContain('export type DirectorySearchSort = "recommended" | "nearest" | "name"');
    expect(searchSource).toContain('if (normalized === "name") return "name"');
    expect(searchSource).toContain('if (normalized === "nearest" && nearbyEnabled) return "nearest"');
    expect(searchSource).toContain('return "recommended"');
    expect(searchSource).toContain("case when ${sort} in ('recommended', 'nearest') and ${nearbyEnabled} = true then distance_km end asc nulls last");
    expect(searchSource).toContain("case when ${sort} in ('recommended', 'nearest') then quality_score end desc nulls last");
    expect(searchSource).toContain("case when ${sort} = 'name' then lower(display_name) end asc nulls last");
  });

  it("does not use plan or entitlement state as a ranking signal", () => {
    const searchSource = source("src/lib/company-directory-public-search.ts");
    const orderBy = searchSource.split("order by\n      case when ${sort}")[1]?.split("limit ${pageSize}")[0] ?? "";

    expect(orderBy).toContain("quality_score");
    expect(orderBy).toContain("display_name");
    expect(orderBy).not.toContain("planAccess");
    expect(orderBy).not.toContain("websiteBuilder");
    expect(orderBy).not.toContain("onlineBooking");
    expect(orderBy).not.toContain("claimed_workspace");
  });

  it("renders localized controls and preserves search state while resetting pagination", () => {
    const sv = renderToStaticMarkup(createElement(PublicDirectorySortControls, {
      locale: "sv",
      sort: "name",
      nearbyActive: true,
      baseHref: "/foretag/listad?service=vvs&location=Stockholm&latitude=59.3&longitude=18.0&radius=25&sort=name&page=3",
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
    expect(sv).toContain("service=vvs");
    expect(sv).toContain("location=Stockholm");
    expect(sv).toContain("latitude=59.3");
    expect(sv).toContain("longitude=18.0");
    expect(sv).not.toContain("page=3");

    expect(en).toContain("Sort");
    expect(en).toContain("Recommended");
    expect(en).toContain("A–Z");
    expect(en).not.toContain("Nearest");
    expect(en).toContain('data-search-sort="recommended" aria-current="page"');
    expect(en).toContain("service=Plumber");
    expect(en).toContain("location=Stockholm");
    expect(en).not.toContain("page=2");
  });

  it("threads sort through both localized pages and pagination state", () => {
    const shell = source("src/components/company-directory/public-directory-search-page.tsx");
    const svPage = source("src/app/foretag/listad/page.tsx");
    const enPage = source("src/app/en/companies/page.tsx");

    expect(shell).toContain('"radius", "sort"');
    expect(shell).toContain("sort: requestedSort");
    expect(shell).toContain("normalizeDirectorySearchSort(requestedSort, nearbyActive)");
    expect(shell).toContain("sort={activeSort}");
    expect(svPage).toContain("sort?: string | string[]");
    expect(enPage).toContain("sort?: string | string[]");
  });
});
