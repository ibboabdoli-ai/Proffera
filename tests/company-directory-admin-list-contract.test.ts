import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Company Directory admin list", () => {
  it("supports complete status filtering instead of truncating the first 100 profiles", () => {
    const code = source("src/app/admin/foretag/directory/page.tsx");

    expect(code).toContain('const PAGE_SIZE = 50');
    expect(code).toContain('{ value: "published", label: "Publicerade" }');
    expect(code).toContain('{ value: "ready", label: "Ready" }');
    expect(code).toContain('{ value: "review", label: "Review" }');
    expect(code).toContain('{ value: "inactive", label: "Inaktiva" }');
    expect(code).toContain('profile.status !== currentStatus');
    expect(code).toContain('filteredProfiles.slice(startIndex, startIndex + PAGE_SIZE)');
    expect(code).not.toContain('snapshot.profiles.slice(0, 100)');
  });

  it("keeps search, pagination and direct access to published profiles", () => {
    const code = source("src/app/admin/foretag/directory/page.tsx");

    expect(code).toContain('placeholder="Sök företag, stad, kategori eller SNI"');
    expect(code).toContain('profile.sniCode');
    expect(code).toContain('profile.city');
    expect(code).toContain('page: currentPage - 1');
    expect(code).toContain('page: currentPage + 1');
    expect(code).toContain('href={directoryHref({ status: "published", query: "" })}');
    expect(code).toContain('href={`/foretag/listad/${encodeURIComponent(profile.slug)}`}');
  });
});
