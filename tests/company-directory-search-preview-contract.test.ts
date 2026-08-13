import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("directory search preview contract", () => {
  const searchSource = readFileSync(
    resolve(process.cwd(), "src/lib/company-directory-search.ts"),
    "utf8",
  );
  const pageSource = readFileSync(
    resolve(process.cwd(), "src/app/admin/foretag/directory/search-preview/page.tsx"),
    "utf8",
  );

  it("searches only safe internal directory states", () => {
    expect(searchSource).toContain("profile.publication_status in ('ready', 'published')");
    expect(searchSource).toContain("profile.is_active = true");
    expect(searchSource).toContain("profile.privacy_blocked = false");
  });

  it("excludes non-geocodable mailbox-style addresses from the pilot", () => {
    expect(searchSource).toContain("lower(profile.address_line1) not like 'box %'");
    expect(searchSource).toContain("lower(profile.address_line1) not like 'kivra:%'");
  });

  it("keeps the preview behind super-admin authorization", () => {
    expect(pageSource).toContain("await requireSuperAdmin()");
    expect(pageSource).toContain("Resultaten är inte offentliga");
  });
});
