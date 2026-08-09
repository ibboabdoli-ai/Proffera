import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const guardedPages = [
  "src/app/admin/foretag/directory/page.tsx",
  "src/app/admin/foretag/directory/preview/page.tsx",
  "src/app/admin/foretag/claims/page.tsx",
];

describe("company directory super-admin route guard", () => {
  for (const path of guardedPages) {
    it(`${path} requires super admin`, () => {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).toContain('import { requireSuperAdmin } from "@/lib/admin-authorization"');
      expect(source).toContain("await requireSuperAdmin()");
    });
  }
});
