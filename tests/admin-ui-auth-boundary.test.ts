import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const adminBoundaryMocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getPlatformAdmin: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/headers", () => ({
  headers: adminBoundaryMocks.headers,
}));

vi.mock("next/navigation", () => ({
  notFound: adminBoundaryMocks.notFound,
  redirect: adminBoundaryMocks.redirect,
}));

vi.mock("@/lib/platform-admin", () => ({
  getPlatformAdmin: adminBoundaryMocks.getPlatformAdmin,
}));

vi.mock("@/components/admin/admin-navigation", () => ({
  AdminNavigation: () => null,
}));

import AdminLayout from "../src/app/admin/layout";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function requestHeaders(pathname: string) {
  return {
    get(name: string) {
      return name === "x-proffera-admin-path" ? pathname : null;
    },
  };
}

describe("admin UI authentication boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminBoundaryMocks.getPlatformAdmin.mockResolvedValue({
      role: "support_admin",
      email: "support@example.test",
    });
  });

  it("passes admin pages to session and route-aware role authorization", () => {
    const code = source("src/proxy.ts");

    expect(code).toContain('const ADMIN_PATH_HEADER = "x-proffera-admin-path"');
    expect(code).toContain("requestHeaders.set(ADMIN_PATH_HEADER, request.nextUrl.pathname)");
    expect(code).toContain("if (isAdminPath(pathname))");
    expect(code).not.toContain("ADMIN_ACCESS_CODE");
    expect(code).not.toContain("WWW-Authenticate");
  });

  it("fails closed when an admin route family has no explicit authorization mapping", async () => {
    adminBoundaryMocks.headers.mockResolvedValue(requestHeaders("/admin/unknown"));

    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(adminBoundaryMocks.notFound).toHaveBeenCalledOnce();
    expect(adminBoundaryMocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a recognized admin route when the current role is not authorized", async () => {
    adminBoundaryMocks.headers.mockResolvedValue(requestHeaders("/admin/billing"));

    await expect(AdminLayout({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT:/admin/saas?denied=1",
    );

    expect(adminBoundaryMocks.notFound).not.toHaveBeenCalled();
    expect(adminBoundaryMocks.redirect).toHaveBeenCalledWith("/admin/saas?denied=1");
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
