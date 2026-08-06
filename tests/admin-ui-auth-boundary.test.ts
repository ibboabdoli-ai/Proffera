import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("admin UI authentication boundary", () => {
  it("leaves admin pages to session and role authorization", () => {
    const code = source("src/proxy.ts");

    expect(code).toContain("function shouldRequireAdminBasicAuth");
    expect(code).not.toContain('pathname === "/admin" ||');
    expect(code).not.toContain('pathname.startsWith("/admin/") ||');
    expect(code).not.toContain("ADMIN_PATH_HEADER");
  });

  it("keeps sensitive admin APIs behind Basic Auth", () => {
    const code = source("src/proxy.ts");

    expect(code).toContain('pathname === "/api/outbox"');
    expect(code).toContain('pathname === "/api/company-admin"');
    expect(code).toContain("return requireAdminAuth(request)");
  });
});
