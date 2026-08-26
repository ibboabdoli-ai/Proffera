import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("admin UI authentication boundary", () => {
  it("passes admin pages to session and route-aware role authorization", () => {
    const code = source("src/proxy.ts");

    expect(code).toContain('const ADMIN_PATH_HEADER = "x-proffera-admin-path"');
    expect(code).toContain("requestHeaders.set(ADMIN_PATH_HEADER, request.nextUrl.pathname)");
    expect(code).toContain("if (isAdminPath(pathname))");
    expect(code).not.toContain("ADMIN_ACCESS_CODE");
    expect(code).not.toContain("WWW-Authenticate");
  });

  it("fails closed when an admin route family has no explicit authorization mapping", () => {
    const layoutCode = source("src/app/admin/layout.tsx");

    expect(layoutCode).toContain("const area = resolveAdminArea(pathname)");
    expect(layoutCode).toContain("if (!area) notFound()");
    expect(layoutCode).toContain("canAccessAdminArea(admin.role, area)");
  });

  it("leaves sensitive admin API authorization to Better Auth and Platform Admin RBAC", () => {
    const proxyCode = source("src/proxy.ts");
    const outboxCode = source("src/app/api/outbox/route.ts");
    const companyAdminCode = source("src/app/api/company-admin/route.ts");

    expect(proxyCode).not.toContain("shouldRequireAdminBasicAuth");
    expect(proxyCode).not.toContain("requireAdminAuth");
    expect(outboxCode).toContain('getAdminForArea("quote_admin")');
    expect(companyAdminCode).toContain("getCompanyAdmin()");
  });
});
